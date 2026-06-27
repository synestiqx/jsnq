import type {
  Action,
  DeleteKeyAction,
  MergeUpdateAction,
  PipelineStats,
  ReplaceAction,
  SearchOptions,
  UpdateAction,
} from './types';
import {
  createJsonPathPlan,
  deleteJsonPath,
  getJsonBySegments,
  hasJsonPath,
  writeJsonPath,
  type JsonPathPlan,
} from './data-engine';
import { deepMerge, isObject } from './utils';

/**
 * Shared application of the "value" actions (replace / update / merge_update /
 * delete_key) against a single matched node. Used by both the DFS pipeline and
 * the flat-array fast path so the semantics, warnings and stats stay identical.
 *
 * Actions are prepared once per execute(): the path is compiled to a JsonPathPlan
 * up front, so per-node application never re-parses paths, and single-segment
 * keys take a direct property access fast path.
 */

type ValueActionType = 'replace' | 'update' | 'merge_update' | 'delete_key';

const VALUE_STATS: Record<ValueActionType, keyof Pick<PipelineStats, 'replaces' | 'updates' | 'mergeUpdates' | 'deletedKeys'>> = {
  replace: 'replaces',
  update: 'updates',
  merge_update: 'mergeUpdates',
  delete_key: 'deletedKeys',
};

export function isValueAction(type: Action['type']): type is ValueActionType {
  return type in VALUE_STATS;
}

export interface PreparedAction {
  action: Action;
  /** Compiled plan for the action's key; null for non-value actions. */
  plan: JsonPathPlan | null;
  /** Single-segment key for direct property access; null when the path is deeper. */
  single: string | null;
}

export function prepareAction(action: Action): PreparedAction {
  if (!isValueAction(action.type)) return { action, plan: null, single: null };
  const key = (action as ReplaceAction | UpdateAction | MergeUpdateAction | DeleteKeyAction).key as string;
  const plan = createJsonPathPlan(key);
  return {
    action,
    plan,
    single: plan.segments.length === 1 ? plan.segments[0] : null,
  };
}

export function prepareActions(actions: ReadonlyArray<Action>): PreparedAction[] {
  return actions.map(prepareAction);
}

function readPrepared(target: unknown, prepared: PreparedAction): unknown {
  if (prepared.single !== null && target != null) {
    return (target as Record<string, unknown>)[prepared.single];
  }
  return getJsonBySegments(target, prepared.plan!.segments);
}

function preparedPathExists(target: unknown, prepared: PreparedAction): boolean {
  if (prepared.single !== null) {
    return target != null && typeof target === 'object' &&
      Object.prototype.hasOwnProperty.call(target, prepared.single);
  }
  return hasJsonPath(target, prepared.plan!);
}

function writePrepared(target: unknown, prepared: PreparedAction, value: unknown): void {
  if (prepared.single !== null && target != null && typeof target === 'object' && !Array.isArray(target)) {
    (target as Record<string, unknown>)[prepared.single] = value;
    return;
  }
  writeJsonPath(target, prepared.plan!, value);
}

function deletePrepared(target: unknown, prepared: PreparedAction): void {
  if (prepared.single !== null && target != null && typeof target === 'object' && !Array.isArray(target)) {
    delete (target as Record<string, unknown>)[prepared.single];
    return;
  }
  deleteJsonPath(target, prepared.plan!);
}

export function computeMergedValue(
  current: unknown,
  action: MergeUpdateAction,
  options: Readonly<SearchOptions>
): unknown {
  if (!isObject(current) || !isObject(action.patch)) return action.patch;
  if (action.deep === true) {
    return deepMerge(current, action.patch, { arrayStrategy: options.arrayMergeStrategy, arrayKey: options.arrayMergeKey });
  }
  return { ...current, ...action.patch };
}

function warnImplicitPath(
  target: unknown,
  prepared: PreparedAction,
  options: Readonly<SearchOptions>,
  stats: PipelineStats,
  message: string
): void {
  if (options.strictPathsWarn && !preparedPathExists(target, prepared)) stats.warnings.push(message);
}

/**
 * Apply a prepared value action to `target`. Returns false when the action is
 * not a value action (caller handles structural actions itself).
 */
export function applyValueAction(
  target: unknown,
  prepared: PreparedAction,
  options: Readonly<SearchOptions>,
  stats: PipelineStats
): boolean {
  const action = prepared.action;
  const key = prepared.plan?.path ?? '';
  switch (action.type) {
    case 'replace':
    case 'update': {
      const act = action as ReplaceAction | UpdateAction;
      const next = typeof act.value === 'function'
        ? (act.value as (current: unknown, node: unknown) => unknown)(readPrepared(target, prepared), target)
        : act.value;
      warnImplicitPath(target, prepared, options, stats, `${action.type}: path '${key}' did not exist; created implicitly`);
      if (!options.dryRun) writePrepared(target, prepared, next);
      stats[VALUE_STATS[action.type]]++;
      if (options.trackOperations !== false) stats.operations.push(`${action.type} ${key}`);
      return true;
    }
    case 'merge_update': {
      const act = action as MergeUpdateAction;
      const merged = computeMergedValue(readPrepared(target, prepared), act, options);
      warnImplicitPath(target, prepared, options, stats, `merge_update: path '${key}' did not exist; created implicitly`);
      if (!options.dryRun) writePrepared(target, prepared, merged);
      stats.mergeUpdates++;
      if (options.trackOperations !== false) stats.operations.push(`merge_update ${key}${act.deep === true ? ' (deep)' : ''}`);
      return true;
    }
    case 'delete_key': {
      warnImplicitPath(target, prepared, options, stats, `delete_key: path '${key}' did not exist`);
      if (!options.dryRun) deletePrepared(target, prepared);
      stats.deletedKeys++;
      if (options.trackOperations !== false) stats.operations.push(`delete_key ${key}`);
      return true;
    }
    default:
      return false;
  }
}
