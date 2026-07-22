import { Action, CompiledCriterion, PipelineStats, SearchOptions, SearchResultNode } from './types.js';
/**
 * Fast path for the most common large-data shape: a flat root array filtered by
 * non-deep criteria and mutated only with value actions (replace / update /
 * merge_update / delete_key). Skips the generic DFS: a single linear scan with
 * actions prepared once. Falls back (returns null) whenever nested descendants
 * could match the criteria, so results stay identical to the full traversal.
 */
type FastPathParams<TData> = {
    data: TData;
    criteria: ReadonlyArray<CompiledCriterion>;
    actions: ReadonlyArray<Action>;
    options: Readonly<SearchOptions>;
    stats: PipelineStats;
    warnedUnknownOps: Set<string>;
    immutableApplied: boolean;
};
export type FlatArrayFastPathResult<TData> = {
    data: TData;
    results: SearchResultNode<TData, unknown, string | number>[];
    immutableApplied: boolean;
};
export declare function executeFlatArrayFastPath<TData>(params: FastPathParams<TData>): FlatArrayFastPathResult<TData> | null;
/**
 * True when any nested descendant (beyond the top-level items) could match the
 * criteria heads — the signal that a flat scan would diverge from full DFS.
 * Shared with pipeline-fastpath.ts so both fast paths bail out identically.
 */
export declare function hasNestedCriterionCandidate(items: unknown[], criteria: ReadonlyArray<CompiledCriterion>, options: Readonly<SearchOptions>): boolean;
export {};
//# sourceMappingURL=flat-array-fast-path.d.ts.map