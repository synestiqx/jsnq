import type { Action, MergeUpdateAction, PipelineStats, SearchOptions } from './types.js';
import { type JsonPathPlan } from './data-engine.js';
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
export declare function isValueAction(type: Action['type']): type is ValueActionType;
export interface PreparedAction {
    action: Action;
    /** Compiled plan for the action's key; null for non-value actions. */
    plan: JsonPathPlan | null;
    /** Single-segment key for direct property access; null when the path is deeper. */
    single: string | null;
}
export declare function prepareAction(action: Action): PreparedAction;
export declare function prepareActions(actions: ReadonlyArray<Action>): PreparedAction[];
export declare function computeMergedValue(current: unknown, action: MergeUpdateAction, options: Readonly<SearchOptions>): unknown;
/**
 * Apply a prepared value action to `target`. Returns false when the action is
 * not a value action (caller handles structural actions itself).
 */
export declare function applyValueAction(target: unknown, prepared: PreparedAction, options: Readonly<SearchOptions>, stats: PipelineStats): boolean;
export {};
//# sourceMappingURL=actions.d.ts.map