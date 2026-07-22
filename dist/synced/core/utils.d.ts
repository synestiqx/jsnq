export declare const isObject: (v: unknown) => v is Record<string, unknown>;
export declare const isRecordObject: (v: unknown) => v is Record<string, unknown>;
export declare const splitPath: (path: string) => string[];
export declare const getBySegments: <T = unknown>(obj: unknown, segments: string[]) => T | undefined;
export declare const setByPath: (obj: unknown, path: string, value: unknown) => void;
export declare const deleteByPath: (obj: unknown, path: string) => void;
export declare const hasPath: (obj: unknown, path: string) => boolean;
export type TraverseFrame<TNode = unknown, TParent = unknown, TKey extends string | number = string | number> = {
    data: TNode;
    path?: string[];
    depth: number;
    parent?: TParent;
    parentKey?: TKey;
};
export interface ScanJsonOptions {
    maxDepth: number;
    includeArrays: boolean;
    includeObjects: boolean;
    buildMeta: boolean;
    returnPaths: boolean;
}
/**
 * Allocation-light DFS for match collection. Stack state is stored in parallel
 * arrays and result nodes are created only for matches, unlike the generator
 * contract which must allocate a frame for every visited value.
 */
export declare function scanJsonMatches(data: unknown, options: ScanJsonOptions, predicate: (node: unknown) => boolean, onMatch: (node: TraverseFrame) => boolean | void): {
    nodesVisited: number;
    maxDepth: number;
    stopped: boolean;
};
export declare function dfsIterator<TNode = unknown, TParent = unknown, TKey extends string | number = string | number>(data: TNode, options: {
    maxDepth: number;
    includeArrays: boolean;
    includeObjects: boolean;
    buildMeta: boolean;
    returnPaths: boolean;
    shouldDescend?: (frame: TraverseFrame<TNode, TParent, TKey>) => boolean;
}): Generator<TraverseFrame<TNode, TParent, TKey>>;
export interface ResolvedTargetPath {
    targetNode: unknown;
    targetParent: unknown;
    targetKey?: string | number;
}
/**
 * Walk `path` from `root` and return the node, its parent and the final key.
 * With `create=true` missing object segments are created ({} or [] when the
 * next segment is numeric) and a missing array index stops the walk (so the
 * parent array + index are returned for relative inserts). With `create=false`
 * nothing is attached: missing segments resolve to a simulated empty node so
 * callers can validate the target shape without mutating the tree.
 */
export declare function resolveTargetPath(root: unknown, path: string, create: boolean): ResolvedTargetPath;
export declare function resolveTargetWithPathCreation(root: unknown, path: string): ResolvedTargetPath;
export type DeepMergeOptions = {
    arrayStrategy?: 'replace' | 'concat' | 'merge-by-key';
    arrayKey?: string | ((x: unknown) => string | number);
};
/**
 * Deep merge overloads for better DX without breaking runtime behavior.
 * - Arrays: returns unknown[] (strategy affects shape).
 * - Objects: returns intersection-like object (A & B).
 * - Fallback: unknown (keeps compatibility).
 */
export declare function deepMerge<A extends unknown[], B extends unknown[]>(a: A, b: B, opts?: DeepMergeOptions): unknown[];
export declare function deepMerge<A extends Record<string, unknown>, B extends Record<string, unknown>>(a: A, b: B, opts?: DeepMergeOptions): A & B;
export declare function deepMerge(a: unknown, b: unknown, opts?: DeepMergeOptions): unknown;
export declare function cloneJson<T>(value: T): T;
export declare function setPathCacheLimit(limit: number): void;
export declare function buildPath(...segments: Array<string | number>): string;
export interface DeepSearchPath {
    isDeep: boolean;
    arrayKey?: string;
    searchSegments: string[];
}
export declare function parseDeepSearchPath(path: string): DeepSearchPath;
export declare function deepArrayMatch(node: unknown, arrayKey: string | undefined, searchSegments: string[], opFn: (a: unknown, b: unknown) => boolean, value: unknown, maxDepth?: number): boolean;
export declare function deepArrayIterator(node: unknown, arrayKey: string | undefined, searchSegments: string[], opFn: (a: unknown, b: unknown) => boolean, value: unknown, path?: string[], depth?: number, maxDepth?: number): Generator<{
    data: unknown;
    path?: string[];
    depth: number;
    parent?: unknown;
    parentKey?: string | number;
}>;
//# sourceMappingURL=utils.d.ts.map