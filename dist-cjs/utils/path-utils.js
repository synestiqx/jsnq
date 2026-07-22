"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PathUtils = void 0;
const data_engine_1 = require("../synced/core/data-engine");
/**
 * Thin host facade over the jsnq data-engine path parser. jsnq is the SSOT
 * for path-expression parsing and its bounded plan cache, so parsing behaves
 * identically here and in every other host project embedding jsnq.
 */
class PathUtils {
    static splitPathExpression(path) {
        if (!path)
            return [];
        return (0, data_engine_1.createJsonPathPlan)(path).segments;
    }
    static setPathExpressionCacheLimit(limit) {
        (0, data_engine_1.setJsonPlanCacheLimit)(limit);
    }
    static getPathExpressionCacheStats() {
        return (0, data_engine_1.getJsonPlanCacheStats)();
    }
    static clearPathExpressionCache() {
        (0, data_engine_1.clearJsonPlanCache)();
    }
}
exports.PathUtils = PathUtils;
//# sourceMappingURL=path-utils.js.map