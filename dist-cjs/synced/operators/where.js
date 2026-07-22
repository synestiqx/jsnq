"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const match_1 = require("../core/match");
function where(key, operator, value) {
    const fn = (pipeline) => {
        const compiled = (0, match_1.compileCriterion)(key, operator, value);
        return pipeline.with({ criteria: [...pipeline.criteria, compiled] });
    };
    // Add cache metadata for pipeline caching
    fn.__cacheKey = JSON.stringify({ op: 'where', key, operator, value });
    return fn;
}
exports.default = where;
//# sourceMappingURL=where.js.map