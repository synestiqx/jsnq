import { clearJsonPlanCache, createJsonPathPlan, getJsonPlanCacheStats, setJsonPlanCacheLimit, } from '../synced/core/data-engine.js';
/**
 * Thin host facade over the jsnq data-engine path parser. jsnq is the SSOT
 * for path-expression parsing and its bounded plan cache, so parsing behaves
 * identically here and in every other host project embedding jsnq.
 */
export class PathUtils {
    static splitPathExpression(path) {
        if (!path)
            return [];
        return createJsonPathPlan(path).segments;
    }
    static setPathExpressionCacheLimit(limit) {
        setJsonPlanCacheLimit(limit);
    }
    static getPathExpressionCacheStats() {
        return getJsonPlanCacheStats();
    }
    static clearPathExpressionCache() {
        clearJsonPlanCache();
    }
}
//# sourceMappingURL=path-utils.js.map