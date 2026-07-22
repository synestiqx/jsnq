import { type JsonPlanCacheStats } from '../synced/core/data-engine.js';
/**
 * Thin host facade over the jsnq data-engine path parser. jsnq is the SSOT
 * for path-expression parsing and its bounded plan cache, so parsing behaves
 * identically here and in every other host project embedding jsnq.
 */
export declare class PathUtils {
    static splitPathExpression(path: string): readonly string[];
    static setPathExpressionCacheLimit(limit: number): void;
    static getPathExpressionCacheStats(): JsonPlanCacheStats;
    static clearPathExpressionCache(): void;
}
//# sourceMappingURL=path-utils.d.ts.map