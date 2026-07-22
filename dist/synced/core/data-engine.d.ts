export type JsonDataPathMode = 'exact' | 'branch';
export interface JsonPathPlan {
    path: string;
    segments: string[];
    parentSegments: string[];
    key: string | null;
    nextIsIndex: boolean[];
}
export type JsonMutationKind = 'set' | 'delete' | 'noop';
export interface JsonMutationResult {
    path: string;
    kind: JsonMutationKind;
    previous: unknown;
    next: unknown;
    existed: boolean;
    changed: string[];
    inserted: string[];
    deleted: string[];
    parents: string[];
    descendants: string[];
    branchReplaced: boolean;
    affectedPaths: string[];
}
export interface JsonMutationResultInit {
    path: string | JsonPathPlan;
    kind: JsonMutationKind;
    previous?: unknown;
    next?: unknown;
    existed?: boolean;
    changed?: readonly string[];
    inserted?: readonly string[];
    deleted?: readonly string[];
    parents?: readonly string[];
    descendants?: readonly string[];
    branchReplaced?: boolean;
    affectedPaths?: readonly string[];
}
export interface JsonResolvedParent {
    parent: any;
    key: string | null;
    segments: string[];
}
/** Bound the compiled path-plan cache (FIFO eviction); floor of 16 entries. */
export declare function setJsonPlanCacheLimit(limit: number): void;
export interface JsonPlanCacheStats {
    size: number;
    limit: number;
    hits: number;
    misses: number;
    writes: number;
    evictions: number;
    hitRate: number;
}
export declare function getJsonPlanCacheStats(): JsonPlanCacheStats;
export declare function clearJsonPlanCache(): void;
export declare function splitJsonPath(path: string): string[];
export declare function createJsonPathPlan(path: string): JsonPathPlan;
export declare function createJsonPathPlanFromSegments(segments: readonly string[]): JsonPathPlan;
export declare function getJsonParentSegments(pathOrPlan: string | JsonPathPlan): string[];
export declare function getJsonAffectedPaths(pathOrPlan: string | JsonPathPlan, mode?: JsonDataPathMode): string[];
export declare function createMutationResult(init: JsonMutationResultInit): JsonMutationResult;
export declare function readJsonPath<T = unknown>(root: unknown, pathOrPlan: string | JsonPathPlan): T | undefined;
export declare function getJsonBySegments<T = unknown>(obj: unknown, segments: readonly string[]): T | undefined;
export declare function hasJsonPath(root: unknown, pathOrPlan: string | JsonPathPlan): boolean;
export declare function resolveJsonParentAndKey(root: unknown, pathOrPlan: string | JsonPathPlan, options?: {
    create?: boolean;
}): JsonResolvedParent;
export declare function writeJsonPath(root: unknown, pathOrPlan: string | JsonPathPlan, value: unknown): JsonMutationResult;
/**
 * Write-only variant for hosts that perform their own wake bookkeeping. It uses
 * the same cached path plan and parent resolver as `writeJsonPath`, but avoids
 * allocating a mutation-result object and path arrays that the caller would discard.
 * Returns false for a root path or an unresolvable target.
 */
export declare function writeJsonPathValue(root: unknown, pathOrPlan: string | JsonPathPlan, value: unknown): boolean;
export declare function deleteJsonPath(root: unknown, pathOrPlan: string | JsonPathPlan): JsonMutationResult;
export declare class JsonDataCursor {
    private cursorNode;
    private cursorPathSegments;
    prefetch(path: string, node: Record<string, unknown> | null): void;
    writeWithPlan(root: Record<string, unknown>, plan: JsonPathPlan, value: unknown): JsonMutationResult;
    invalidateForDeletion(path: string): void;
    clear(): void;
    get active(): boolean;
}
/**
 * Clone the JSON-like state shape without paying structuredClone's serializer
 * overhead for ordinary arrays and records. Non-plain host objects retain the
 * previous structuredClone behavior; the WeakMap also preserves shared refs
 * and cycles for plain data supplied through untyped JavaScript callers.
 */
export declare function cloneJsonData<T>(value: T): T;
//# sourceMappingURL=data-engine.d.ts.map