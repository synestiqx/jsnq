import { InsertPosition, SearchResultNode, SearchOptions, ComparisonOperator } from './types.js';
import { ResolvedTargetPath } from './utils.js';
type MutableRecord = Record<string, unknown>;
export declare function assignWithPolicy(target: MutableRecord, key: string | number, value: unknown, options: SearchOptions | undefined, stats: {
    warnings: string[];
} | undefined, errorFactory: (conflictKey: string) => Error): boolean;
export declare function getAssignmentEffect(target: MutableRecord, key: string | number, options: SearchOptions | undefined, errorFactory: (conflictKey: string) => Error): 'write' | 'skip';
/**
 * Remove the current node from its original parent container.
 */
export declare function canRemoveFromOriginal(node: SearchResultNode): boolean;
/** Remove only when the captured parent still owns this exact node. */
export declare function removeFromOriginal(node: SearchResultNode): boolean;
export declare function assertCanInsertIntoTargetPath(root: unknown, positionPath: string, mode?: InsertPosition, key?: string | number): ResolvedTargetPath;
/** Preflight overwrite policy and relative-target availability before source removal. */
export declare function canInsertIntoResolvedTarget(resolved: ResolvedTargetPath, data: unknown, mode?: InsertPosition, key?: string | number, options?: SearchOptions): boolean;
/** True when inserting `source` at `target` would attach it below itself. */
export declare function wouldCreateMoveCycle(source: unknown, target: ResolvedTargetPath | SearchResultNode, mode?: InsertPosition): boolean;
/** O(path depth) cycle guard for moveTo(path), including aliased source branches. */
export declare function wouldCreateMoveCycleAtPath(root: unknown, source: unknown, positionPath: string): boolean;
/**
 * Insert data relative to a reference node (inside/before/after).
 */
export declare function insertRelative(ref: SearchResultNode, data: unknown, position?: InsertPosition, key?: string | number, options?: SearchOptions, stats?: {
    warnings: string[];
}): boolean;
export declare function canInsertRelative(ref: SearchResultNode, data: unknown, position?: InsertPosition, key?: string | number, options?: SearchOptions): boolean;
/**
 * Insert the given data into a target path on the root, supporting inside/before/after semantics.
 * Mirrors the logic previously embedded in pipeline for move/copy/insert_to.
 */
export declare function insertIntoTargetPath(root: unknown, positionPath: string, data: unknown, mode: InsertPosition | undefined, resolver: (root: unknown, path: string) => ResolvedTargetPath, key?: string | number, options?: SearchOptions, stats?: {
    warnings: string[];
}): void;
export declare function selectTargets(root: unknown, options: SearchOptions, targetKey: string, targetOperator: ComparisonOperator, targetValue: unknown, buildMeta?: boolean): SearchResultNode[];
export declare function fanoutMatchesToTargets(kind: 'move' | 'copy', matches: SearchResultNode[], targets: SearchResultNode[], mode?: InsertPosition, key?: string | number, options?: SearchOptions, stats?: {
    warnings: string[];
}, dryRun?: boolean): number;
export declare function orderMatchesForMove(matches: SearchResultNode[]): SearchResultNode[];
export {};
//# sourceMappingURL=ops.d.ts.map