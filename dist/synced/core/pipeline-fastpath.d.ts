import type { Action, CompiledCriterion } from './types.js';
/**
 * Host-commit fast path for `store.mutate(where(...), update(...))`-style calls.
 *
 * The generic flow used by host stores is: deep-clone the whole branch, run the
 * pipeline on the clone, commit the clone. For the #1 real-world shape — a flat
 * array filtered by non-deep criteria and mutated only with value actions —
 * that clones thousands of untouched items for nothing. This module computes
 * the same result with copy-on-write: a new outer array, matched items deep-
 * cloned and mutated via the exact same `actions.ts` appliers the pipeline
 * uses, untouched items shared by reference.
 *
 * Identity contract: the returned array is OWNED by the caller's store commit.
 * Unmatched elements alias the input (like solid-pipeline-bridge always did),
 * so the input itself is never mutated, but the output must be treated as the
 * next store state, not as an independent deep snapshot.
 *
 * Guards mirror the pipeline's flat-array fast path (same nested-candidate
 * probe), so whenever DFS could match a nested node we return undefined and
 * the caller falls back to the full pipeline — semantics stay identical.
 */
export interface PipelineIntent {
    criteria: CompiledCriterion[];
    actions: Action[];
    /** True when any operator tried to set pipeline options (limit/immutable/...). */
    optionsTouched: boolean;
}
export interface FastMutationResult<TData = unknown> {
    value: TData;
    /** Number of value-action applications (matched items × actions). */
    mutations: number;
    /** Number of items that matched the criteria. */
    matched: number;
    /** Changed paths relative to the branch, or null for non-precise shapes. */
    affectedPaths: string[] | null;
}
export interface FastMutationOptions {
    /**
     * Keep exact changed paths for precise host wakeups. Disable when the caller
     * only commits the returned value; this avoids one result object per match.
     */
    collectAffectedPaths?: boolean;
}
export declare function collectPipelineIntent(ops: ReadonlyArray<unknown>): PipelineIntent;
/**
 * Affected leaf paths (relative to the branch) for the flat value-action shape, so a
 * host can wake exactly the changed leaves instead of the whole branch ("grained" wake).
 * Returns null whenever the shape is not the guarded flat value-action fast path (same
 * guards as tryFastPipelineMutation), in which case the caller must fall back to a normal
 * branch commit. Pure read: never mutates the input. Shared by every host (Solid bridge,
 * Angular proxy) so fine-grained mutate wake stays logically identical across engines.
 */
export declare function collectFlatValueActionPaths(currentValue: unknown, ops: ReadonlyArray<unknown>): string[] | null;
/**
 * Try the COW flat-array mutation. Returns undefined whenever the shape is not
 * the guarded hot path — callers must then run the full pipeline unchanged.
 */
export declare function tryFastPipelineMutation<TData = unknown>(currentValue: TData, ops: ReadonlyArray<unknown>, options?: FastMutationOptions): FastMutationResult<TData> | undefined;
/**
 * COW append for insert_to(position, data, 'inside') targeting an existing
 * array. Clones only the spine from root to the target array plus a shallow
 * copy of that array; untouched branches stay shared. Returns a NEW root, or
 * undefined when the shape is not the simple array-append form.
 */
export declare function applyInsertToInsideArrayCow(currentValue: unknown, position: string, data: unknown): unknown | undefined;
/**
 * Try the criteria-less single-action shortcuts. The result is COW like
 * tryFastPipelineMutation (input never mutated, untouched branches shared).
 */
export declare function tryFastStructuralMutation<TData = unknown>(currentValue: TData, intent: PipelineIntent): FastMutationResult<TData> | undefined;
/** update({patch}) / replace({patch}) sugar on object trees (key is the patch). */
export declare function isDeepSugarAction(action: unknown): boolean;
/**
 * Sugar deep update: where('deep.path.to.leaf', op, X) + update({patch}).
 * The patch is applied at the PARENT object of the leaf named by the last
 * where segment; when the leaf exists but is null/undefined the patch object
 * replaces the leaf slot itself. This form is not representable in the raw
 * pipeline (action keys must be string paths), so this helper is the
 * canonical semantics for every host. Input is never mutated.
 */
export declare function applyDeepSugarPatch(current: unknown, criteria: ReadonlyArray<unknown>, actions: ReadonlyArray<unknown>): unknown;
//# sourceMappingURL=pipeline-fastpath.d.ts.map