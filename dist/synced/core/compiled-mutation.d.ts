import type { Action, CompiledCriterion, PipelineStats, SearchResultNode } from './types.js';
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
export type CompiledFlatMutation<T = unknown> = (items: T[], options: CompiledFlatMutationOptions, stats: PipelineStats) => SearchResultNode<T, unknown, string | number>[];
export declare function setCompiledMutationCacheLimit(limit: number): void;
export declare function clearCompiledMutationCache(): void;
export declare function isFlatMutationCodegenable(criteria: ReadonlyArray<CompiledCriterion>, actions: ReadonlyArray<Action>): boolean;
export declare function compileFlatMutation<T = unknown>(criteria: ReadonlyArray<CompiledCriterion>, actions: ReadonlyArray<Action>): CompiledFlatMutation<T> | null;
//# sourceMappingURL=compiled-mutation.d.ts.map