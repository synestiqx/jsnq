/**
 * jsnq-match-actions.test.ts
 *
 * Focused unit tests for the two standalone jsnq core seams introduced by the
 * dedup refactor: core/match.ts (criteria compile/match + strict operator policy)
 * and core/actions.ts (prepared value actions shared by pipeline & fast path).
 * These run without the pipeline, proving each part is independently testable.
 *
 * Run: bun test/jsnq-match-actions.test.ts
 */

import {
  compileCriterion,
  criterionMatches,
  criteriaMatch,
  enforceKnownOperator,
} from '../src/synced/core/match';
import {
  prepareActions,
  applyValueAction,
  isValueAction,
} from '../src/synced/core/actions';
import type { PipelineStats, UpdateAction, MergeUpdateAction, DeleteKeyAction } from '../src/synced/core/types';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean) {
  if (cond) { passed++; console.log(`✅ ${name}`); }
  else { failed++; console.error(`❌ ${name}`); }
}

function freshStats(): PipelineStats {
  return {
    searchTime: 0, nodesVisited: 0, resultsFound: 0, maxDepth: 0,
    replaces: 0, updates: 0, mergeUpdates: 0, deletedKeys: 0, deletedElements: 0,
    inserted: 0, moved: 0, copied: 0, warnings: [], operations: [],
  };
}

// === match.ts ===

{
  const c = compileCriterion('user.name', '===', 'Ala');
  check('compileCriterion: plain path segments', c.segments.join(',') === 'user,name' && !c.isDeep && c.knownOperator);
  check('criterionMatches: nested hit', criterionMatches(c, { user: { name: 'Ala' } }));
  check('criterionMatches: nested miss', !criterionMatches(c, { user: { name: 'Ola' } }));
  check('criterionMatches: missing head key', !criterionMatches(c, { other: 1 }));
  check('criterionMatches: primitive node', !criterionMatches(c, 42));
}

{
  const c = compileCriterion('fields@id', '===', 'x1');
  check('compileCriterion: deep arrayKey', c.isDeep === true && c.deepArrayKey === 'fields' && c.segments.join(',') === 'id');
  const cAt = compileCriterion('@id', '===', 'x1');
  check('compileCriterion: bare @ (current array)', cAt.isDeep === true && cAt.deepArrayKey === undefined);
}

{
  const idx = compileCriterion('0', '===', 'a');
  check('criterionMatches: array index in range', criterionMatches(idx, ['a', 'b']));
  check('criterionMatches: array index out of range', !criterionMatches(compileCriterion('5', '===', 'a'), ['a']));
}

{
  const deep = compileCriterion('fields@type', '===', 'text');
  const data = { fields: [{ type: 'group', fields: [{ type: 'text' }] }] };
  const ctx = { warnedUnknownOps: new Set<string>(), warnings: [] as string[] };
  check('criteriaMatch: deep criterion over nested arrays', criteriaMatch([deep], data, {}, ctx));
  check('criteriaMatch: empty criteria always true', criteriaMatch([], { a: 1 }, {}, ctx));
}

{
  const unknown = compileCriterion('a', 'no_such_op', 1);
  check('compileCriterion: unknown operator flagged', unknown.knownOperator === false);
  const ctx = { warnedUnknownOps: new Set<string>(), warnings: [] as string[] };
  enforceKnownOperator(unknown, { operatorsStrict: 'warn' }, ctx);
  enforceKnownOperator(unknown, { operatorsStrict: 'warn' }, ctx);
  check('enforceKnownOperator: warn once per op', ctx.warnings.length === 1 && ctx.warnings[0].includes('no_such_op'));
  let threw = false;
  try { enforceKnownOperator(unknown, { operatorsStrict: 'throw' }, ctx); } catch { threw = true; }
  check('enforceKnownOperator: throw mode', threw);
  const silent = { warnedUnknownOps: new Set<string>(), warnings: [] as string[] };
  enforceKnownOperator(unknown, {}, silent);
  check('enforceKnownOperator: default is silent', silent.warnings.length === 0);
}

// === actions.ts ===

{
  check('isValueAction: classification', isValueAction('update') && isValueAction('delete_key') && !isValueAction('move') && !isValueAction('insert_to'));
  const prepared = prepareActions([
    { type: 'update', key: 'a.b', value: 1 } as UpdateAction,
    { type: 'move', position: 'x' } as never,
  ]);
  check('prepareActions: plan only for value actions', prepared[0].plan !== null && prepared[1].plan === null);
  check('prepareActions: single only for 1-segment keys', prepared[0].single === null && prepareActions([{ type: 'update', key: 'a', value: 1 } as UpdateAction])[0].single === 'a');
}

{
  // update with function value receives (current, node)
  const stats = freshStats();
  const target = { score: 2, meta: { tag: 'x' } };
  const [prep] = prepareActions([{ type: 'update', key: 'score', value: (cur: number, node: unknown) => cur * 10 + ((node as { score: number }).score ? 1 : 0) } as UpdateAction]);
  const handled = applyValueAction(target, prep, {}, stats);
  check('applyValueAction: update fn(current,node)', handled && target.score === 21 && stats.updates === 1 && stats.operations[0] === 'update score');
}

{
  // deep path write creates intermediates (same as pipeline semantics)
  const stats = freshStats();
  const target: Record<string, unknown> = {};
  const [prep] = prepareActions([{ type: 'replace', key: 'a.b.c', value: 7 } as never]);
  applyValueAction(target, prep, { strictPathsWarn: true }, stats);
  check('applyValueAction: replace creates path + strict warning',
    ((target.a as Record<string, Record<string, number>>).b.c === 7) &&
    stats.replaces === 1 && stats.warnings.length === 1 && stats.warnings[0].includes("path 'a.b.c' did not exist"));
}

{
  // merge_update shallow vs deep
  const stats = freshStats();
  const target = { cfg: { a: { x: 1 }, keep: true } };
  const [shallow] = prepareActions([{ type: 'merge_update', key: 'cfg', patch: { a: { y: 2 } } } as MergeUpdateAction]);
  applyValueAction(target, shallow, {}, stats);
  check('applyValueAction: merge_update shallow replaces subobjects', (target.cfg.a as Record<string, number>).y === 2 && (target.cfg.a as Record<string, number>).x === undefined && target.cfg.keep === true);

  const target2 = { cfg: { a: { x: 1 } } };
  const [deep] = prepareActions([{ type: 'merge_update', key: 'cfg', patch: { a: { y: 2 } }, deep: true } as MergeUpdateAction]);
  applyValueAction(target2, deep, {}, stats);
  check('applyValueAction: merge_update deep merges subobjects', (target2.cfg.a as Record<string, number>).x === 1 && (target2.cfg.a as Record<string, number>).y === 2);
  check('applyValueAction: merge_update stats + (deep) label', stats.mergeUpdates === 2 && stats.operations[1] === 'merge_update cfg (deep)');
}

{
  // delete_key: object key delete + array index splice via plan path
  const stats = freshStats();
  const obj = { a: 1, b: 2 };
  applyValueAction(obj, prepareActions([{ type: 'delete_key', key: 'a' } as DeleteKeyAction])[0], {}, stats);
  check('applyValueAction: delete_key object', !('a' in obj) && obj.b === 2 && stats.deletedKeys === 1);

  const wrap = { arr: [1, 2, 3] };
  applyValueAction(wrap, prepareActions([{ type: 'delete_key', key: 'arr.1' } as DeleteKeyAction])[0], {}, stats);
  check('applyValueAction: delete_key array index splices', wrap.arr.join(',') === '1,3');
}

{
  // dryRun: stats yes, mutation no
  const stats = freshStats();
  const target = { v: 1 };
  applyValueAction(target, prepareActions([{ type: 'update', key: 'v', value: 99 } as UpdateAction])[0], { dryRun: true }, stats);
  check('applyValueAction: dryRun counts without mutating', target.v === 1 && stats.updates === 1);
}

{
  // non-value action returns false and records nothing
  const stats = freshStats();
  const handled = applyValueAction({}, prepareActions([{ type: 'delete_element' } as never])[0], {}, stats);
  check('applyValueAction: structural action returns false', handled === false && stats.operations.length === 0);
}

{
  // forbidden path segment rejected at prepare time
  let threw = false;
  try { prepareActions([{ type: 'update', key: '__proto__.x', value: 1 } as UpdateAction]); } catch { threw = true; }
  check('prepareActions: forbidden segment throws', threw);
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
