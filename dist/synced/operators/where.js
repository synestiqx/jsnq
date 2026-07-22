import { compileCriterion } from '../core/match.js';
function where(key, operator, value) {
    const fn = (pipeline) => {
        const compiled = compileCriterion(key, operator, value);
        return pipeline.with({ criteria: [...pipeline.criteria, compiled] });
    };
    // Add cache metadata for pipeline caching
    fn.__cacheKey = JSON.stringify({ op: 'where', key, operator, value });
    return fn;
}
export default where;
//# sourceMappingURL=where.js.map