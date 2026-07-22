"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.compileCriterion = compileCriterion;
exports.enforceKnownOperator = enforceKnownOperator;
exports.criterionMatches = criterionMatches;
exports.criteriaMatch = criteriaMatch;
const operators_registry_1 = require("./operators-registry");
const utils_1 = require("./utils");
function compileCriterion(key, operator, value) {
    const deep = (0, utils_1.parseDeepSearchPath)(key);
    return {
        segments: deep.isDeep ? deep.searchSegments : (0, utils_1.splitPath)(key),
        operator,
        value,
        opFn: (0, operators_registry_1.getOperatorFn)(operator),
        knownOperator: (0, operators_registry_1.isOperatorKnown)(String(operator)),
        isDeep: deep.isDeep,
        deepArrayKey: deep.arrayKey,
    };
}
/** Apply the `operatorsStrict` policy for a possibly-unknown operator. */
function enforceKnownOperator(criterion, options, ctx) {
    if (criterion.knownOperator)
        return;
    const mode = options.operatorsStrict;
    if (mode === 'throw') {
        throw new Error(`jsnq: unknown comparison operator '${String(criterion.operator)}'`);
    }
    if (mode === 'warn') {
        const key = String(criterion.operator);
        if (!ctx.warnedUnknownOps.has(key)) {
            ctx.warnedUnknownOps.add(key);
            ctx.warnings.push(`unknown comparison operator '${key}'`);
        }
    }
}
/**
 * Standard (non-deep) criterion check against a node value: the first segment
 * must be present on the node (array index in range / own object key), then the
 * extracted value is compared via the registered operator.
 */
function criterionMatches(criterion, data) {
    const seg0 = criterion.segments[0];
    if (seg0 !== undefined) {
        if (Array.isArray(data)) {
            if (seg0 === 'length') {
                if (criterion.segments.length === 1)
                    return criterion.opFn(data.length, criterion.value);
            }
            else {
                const idx = Number(seg0);
                if (Number.isNaN(idx) || idx < 0 || idx >= data.length)
                    return false;
                // Single-segment fast path for array nodes: the value is the element itself (index
                // validated above). Direct indexing beats the generic segment walk ~4x here; the
                // object and multi-segment paths are left byte-identical to avoid any JIT regression.
                if (criterion.segments.length === 1)
                    return criterion.opFn(data[idx], criterion.value);
            }
        }
        else if ((0, utils_1.isObject)(data)) {
            if (!(seg0 in data))
                return false;
        }
        else {
            return false;
        }
    }
    const val = (0, utils_1.getBySegments)(data, criterion.segments);
    return criterion.opFn(val, criterion.value);
}
/**
 * Full criteria conjunction (deep `@` criteria included) with strict-operator
 * policy applied per criterion, in order, stopping at the first failure.
 */
function criteriaMatch(criteria, data, options, ctx) {
    for (let i = 0; i < criteria.length; i++) {
        const c = criteria[i];
        enforceKnownOperator(c, options, ctx);
        if (c.isDeep) {
            if (!(0, utils_1.deepArrayMatch)(data, c.deepArrayKey, c.segments, c.opFn, c.value, options.maxDepth ?? 10))
                return false;
            continue;
        }
        if (!criterionMatches(c, data))
            return false;
    }
    return true;
}
//# sourceMappingURL=match.js.map