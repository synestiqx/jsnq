import {
  clearJsonPlanCache,
  createJsonPathPlan,
  getJsonPlanCacheStats,
  setJsonPlanCacheLimit,
  type JsonPlanCacheStats,
} from '../synced/core/data-engine';

/**
 * Thin host facade over the jsondb data-engine path parser. jsondb is the SSOT
 * for path-expression parsing and its bounded plan cache, so parsing behaves
 * identically here and in every other host project embedding jsondb.
 */
export class PathUtils {
  static splitPathExpression(path: string): readonly string[] {
    if (!path) return [];
    return createJsonPathPlan(path).segments;
  }

  static setPathExpressionCacheLimit(limit: number): void {
    setJsonPlanCacheLimit(limit);
  }

  static getPathExpressionCacheStats(): JsonPlanCacheStats {
    return getJsonPlanCacheStats();
  }

  static clearPathExpressionCache(): void {
    clearJsonPlanCache();
  }
}
