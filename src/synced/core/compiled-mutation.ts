import type { Action, CompiledCriterion, PipelineStats, SearchResultNode } from './types';
import { opExpr } from './compiled-predicate';
import { isOperatorKnown } from './operators-registry';
import { createJsonPathPlan } from './data-engine';

/**
 * Optional codegen fast path for flat-array mutations. Compiles a set of
 * single-segment, non-deep, built-in-operator criteria + value actions into a
 * single `for` loop over the array, removing per-item operator indirection,
 * prepared-action wrappers and plan-path lookups.
 *
 * Falls back to the interpreter whenever anything is not trivially codegen-able:
 * deep `@` criteria, multi-segment paths, regex/custom operators, function values,
 * deep merge_update, or structural actions. The generated code mirrors the semantics of
 * `criteriaMatch` + `applyValueAction` for the supported subset.
 */

export type CompiledFlatMutationOptions = {
  immutable?: boolean;
  dryRun?: boolean;
  needPaths?: boolean;
  strictPathsWarn?: boolean;
  clone?: (v: unknown) => unknown;
  trackOperations?: boolean;
  /** Skip result-node allocation when a host only needs the mutated value/stats. */
  collectResults?: boolean;
};

export type CompiledFlatMutation<T = unknown> = (
  items: T[],
  options: CompiledFlatMutationOptions,
  stats: PipelineStats
) => SearchResultNode<T, unknown, string | number>[];

type FlatMutationFactory = (
  items: unknown[],
  vals: unknown[],
  opts: CompiledFlatMutationOptions,
  stats: PipelineStats
) => SearchResultNode<unknown, unknown, string | number>[];

let canCompile: boolean | null = null;
function compilationAvailable(): boolean {
  if (canCompile !== null) return canCompile;
  try { new Function('return true'); canCompile = true; } catch { canCompile = false; }
  return canCompile;
}

const factoryCache = new Map<string, FlatMutationFactory | null>();
let cacheMax = 2000;
export function setCompiledMutationCacheLimit(limit: number): void { cacheMax = Math.max(0, limit | 0); }
export function clearCompiledMutationCache(): void { factoryCache.clear(); }

function actionIsCodegenable(a: Action): boolean {
  if (a.type === 'update' || a.type === 'replace') {
    const key = (a as { key?: unknown }).key;
    const value = (a as { value?: unknown }).value;
    if (typeof key !== 'string' || key.length === 0 || typeof value === 'function') return false;
    return createJsonPathPlan(key).segments.length === 1;
  }
  if (a.type === 'delete_key') {
    const key = (a as { key?: unknown }).key;
    if (typeof key !== 'string' || key.length === 0) return false;
    return createJsonPathPlan(key).segments.length === 1;
  }
  if (a.type === 'merge_update') {
    const key = (a as { key?: unknown }).key;
    if (typeof key !== 'string' || key.length === 0 || (a as { deep?: unknown }).deep === true) return false;
    return createJsonPathPlan(key).segments.length === 1;
  }
  return false;
}

function criteriaAreCodegenable(criteria: ReadonlyArray<CompiledCriterion>): boolean {
  if (criteria.length === 0) return false;
  for (const c of criteria) {
    if (c.isDeep) return false;
    if (c.segments.length !== 1) return false;
    if (c.segments[0] === undefined) return false;
    if (!isOperatorKnown(String(c.operator))) return false;
    if (opExpr(String(c.operator), 'a', 'b') === null) return false;
  }
  return true;
}

export function isFlatMutationCodegenable(
  criteria: ReadonlyArray<CompiledCriterion>,
  actions: ReadonlyArray<Action>
): boolean {
  if (!compilationAvailable()) return false;
  if (!criteriaAreCodegenable(criteria)) return false;
  if (actions.length === 0) return false;
  for (const a of actions) {
    if (!actionIsCodegenable(a)) return false;
  }
  return true;
}

function statKeyForAction(type: Action['type']): keyof PipelineStats | null {
  switch (type) {
    case 'update': return 'updates';
    case 'replace': return 'replaces';
    case 'delete_key': return 'deletedKeys';
    case 'merge_update': return 'mergeUpdates';
    default: return null;
  }
}

function buildFactory(
  criteria: ReadonlyArray<CompiledCriterion>,
  actions: ReadonlyArray<Action>
): FlatMutationFactory | null {
  const valueCount = criteria.length;
  const predicateParts: string[] = [];
  for (let i = 0; i < criteria.length; i++) {
    const key = JSON.stringify(criteria[i].segments[0]);
    const expr = opExpr(String(criteria[i].operator), `it[${key}]`, `vals[${i}]`)!;
    predicateParts.push(`((${key} in it) && (${expr}))`);
  }
  const predicate = predicateParts.join(' && ');

  const actionLines: string[] = [];
  const statIncrements: string[] = [];
  const operationPushes: string[] = [];
  for (let i = 0; i < actions.length; i++) {
    const a = actions[i];
    const key = JSON.stringify((a as { key: string }).key);
    const statKey = statKeyForAction(a.type);
    if (!statKey) return null;
    if (a.type === 'delete_key') {
      operationPushes.push(`if (opts.trackOperations !== false) stats.operations.push('delete_key ' + ${key});`);
      statIncrements.push(`stats.${String(statKey)}++;`);
      actionLines.push(
        `if (opts.strictPathsWarn && !Object.prototype.hasOwnProperty.call(target, ${key})) stats.warnings.push("delete_key: path '" + ${key} + "' did not exist");`,
        `if (!opts.dryRun) delete target[${key}];`
      );
    } else if (a.type === 'merge_update') {
      const patch = `vals[${valueCount + i}]`;
      const current = `current${i}`;
      operationPushes.push(`if (opts.trackOperations !== false) stats.operations.push('merge_update ' + ${key});`);
      statIncrements.push(`stats.${String(statKey)}++;`);
      actionLines.push(
        `if (opts.strictPathsWarn && !Object.prototype.hasOwnProperty.call(target, ${key})) stats.warnings.push("merge_update: path '" + ${key} + "' did not exist; created implicitly");`,
        `if (!opts.dryRun) { var ${current} = target[${key}]; target[${key}] = (${current} !== null && typeof ${current} === 'object' && ${patch} !== null && typeof ${patch} === 'object') ? Object.assign({}, ${current}, ${patch}) : ${patch}; }`
      );
    } else {
      operationPushes.push(`if (opts.trackOperations !== false) stats.operations.push('${a.type} ' + ${key});`);
      statIncrements.push(`stats.${String(statKey)}++;`);
      actionLines.push(
        `if (opts.strictPathsWarn && !Object.prototype.hasOwnProperty.call(target, ${key})) stats.warnings.push("${a.type}: path '" + ${key} + "' did not exist; created implicitly");`,
        `if (!opts.dryRun) target[${key}] = vals[${valueCount + i}];`
      );
    }
  }

  const source = [
    `var results = [];`,
    `var needPaths = opts.needPaths;`,
    `var collectResults = opts.collectResults !== false;`,
    `var immutable = opts.immutable;`,
    `var dryRun = opts.dryRun;`,
    `var mutated = 0;`,
    `for (var i = 0; i < items.length; i++) {`,
    `  var it = items[i];`,
    `  if (it === null || typeof it !== 'object') continue;`,
    `  if (!(${predicate})) continue;`,
    `  stats.resultsFound++;`,
    ...statIncrements.map((l) => `  ${l}`),
    ...operationPushes.map((l) => `  ${l}`),
    `  var target = immutable && !dryRun ? opts.clone(it) : it;`,
    ...actionLines.map((l) => `  ${l}`),
    `  if (immutable && !dryRun) items[i] = target;`,
    `  if (collectResults && needPaths) results.push({ data: target, path: [String(i)], depth: 1, parent: items, parentKey: i });`,
    `  else if (collectResults) results.push({ data: target, depth: 1 });`,
    `  mutated++;`,
    `}`,
    `return results;`,
  ].join('\n');

  try {
    return new Function('items', 'vals', 'opts', 'stats', source) as FlatMutationFactory;
  } catch {
    return null;
  }
}

export function compileFlatMutation<T = unknown>(
  criteria: ReadonlyArray<CompiledCriterion>,
  actions: ReadonlyArray<Action>
): CompiledFlatMutation<T> | null {
  if (!isFlatMutationCodegenable(criteria, actions)) return null;
  const sig =
    criteria.map((c) => `${c.segments[0]}\x01${c.operator}`).join('\x02') +
    '\x03' +
    actions.map((a) => {
      const key = (a as { key?: unknown }).key;
      if (a.type === 'update' || a.type === 'replace') {
        return `${a.type}\x01${key}`;
      }
      return `${a.type}\x01${key}`;
    }).join('\x02');
  let factory = factoryCache.get(sig);
  if (factory === undefined) {
    factory = buildFactory(criteria, actions);
    if (factoryCache.size >= cacheMax) factoryCache.clear();
    factoryCache.set(sig, factory);
  }
  if (!factory) return null;
  const vals = [
    ...criteria.map((c) => c.value),
    ...actions.map((a) => a.type === 'merge_update'
      ? (a as { patch?: unknown }).patch
      : (a as { value?: unknown }).value),
  ];
  return ((items, opts, stats) =>
    factory!(items as unknown[], vals, opts, stats) as SearchResultNode<T, unknown, string | number>[]
  ) as CompiledFlatMutation<T>;
}
