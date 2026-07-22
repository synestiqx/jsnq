"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.executeFlatArrayFastPath = executeFlatArrayFastPath;
exports.hasNestedCriterionCandidate = hasNestedCriterionCandidate;
const utils_1 = require("./utils");
const match_1 = require("./match");
const compiled_predicate_1 = require("./compiled-predicate");
const actions_1 = require("./actions");
const compiled_mutation_1 = require("./compiled-mutation");
const ops_1 = require("./ops");
function executeFlatArrayFastPath(params) {
    if (!canUseFlatArrayFastPath(params))
        return null;
    const shouldClone = params.options.immutable === true ||
        (params.options.immutable === 'auto' && params.actions.length > 0);
    const workingData = shouldClone && !params.immutableApplied
        ? (0, utils_1.cloneJson)(params.data)
        : params.data;
    const items = workingData;
    const results = [];
    const limit = params.options.limit ?? (params.options.earlyTermination ? 1 : undefined);
    const needPaths = params.options.returnPaths !== false && (params.options.buildMeta || params.actions.length > 0);
    const isDeleteElementOnly = params.actions.length === 1 && params.actions[0].type === 'delete_element';
    const relativeInsert = getRelativeInsert(params.actions);
    const preparedActions = isDeleteElementOnly || relativeInsert ? [] : (0, actions_1.prepareActions)(params.actions);
    const strictCtx = { warnedUnknownOps: params.warnedUnknownOps, warnings: params.stats.warnings };
    // Codegen fast path for the per-item match (null → interpreter; results identical).
    const pred = (0, compiled_predicate_1.compileCriteriaPredicate)(params.criteria);
    const deleteIndices = isDeleteElementOnly ? [] : [];
    // Whole-loop codegen: match + mutate in one inlined function. Skip when there is
    // a limit/earlyTermination (compiled loop does not truncate) or when the only
    // action is delete_element (handled by the optimized path below).
    const hasLimit = params.options.limit !== undefined || params.options.earlyTermination;
    const compiledMutation = !hasLimit && !isDeleteElementOnly && !relativeInsert
        ? (0, compiled_mutation_1.compileFlatMutation)(params.criteria, params.actions)
        : null;
    if (compiledMutation) {
        params.stats.nodesVisited += items.length + 1;
        params.stats.maxDepth = Math.max(params.stats.maxDepth, 1);
        const results = compiledMutation(items, {
            immutable: shouldClone && !params.immutableApplied,
            dryRun: !!params.options.dryRun,
            needPaths,
            strictPathsWarn: !!params.options.strictPathsWarn,
            clone: utils_1.cloneJson,
            trackOperations: params.options.trackOperations,
        }, params.stats);
        return {
            data: workingData,
            results,
            immutableApplied: params.immutableApplied || shouldClone,
        };
    }
    params.stats.nodesVisited++;
    params.stats.maxDepth = Math.max(params.stats.maxDepth, 0);
    for (let index = 0; index < items.length; index++) {
        const item = items[index];
        params.stats.nodesVisited++;
        params.stats.maxDepth = Math.max(params.stats.maxDepth, 1);
        if (!(pred ? pred(item) : (0, match_1.criteriaMatch)(params.criteria, item, params.options, strictCtx)))
            continue;
        params.stats.resultsFound++;
        const node = {
            data: item,
            path: needPaths ? [String(index)] : undefined,
            depth: 1,
            parent: workingData,
            parentKey: index,
        };
        if (isDeleteElementOnly) {
            deleteIndices.push(index);
            results.push(node);
            if (limit && results.length >= limit)
                break;
            continue;
        }
        if (relativeInsert) {
            results.push(node);
            if (limit && results.length >= limit)
                break;
            continue;
        }
        for (const prepared of preparedActions) {
            (0, actions_1.applyValueAction)(item, prepared, params.options, params.stats);
        }
        results.push(node);
        if (limit && results.length >= limit)
            break;
    }
    if (isDeleteElementOnly) {
        params.stats.deletedElements += deleteIndices.length;
        if (!params.options.dryRun) {
            // Matches arrive in ascending index order. Compact once instead of doing
            // N descending splices (which turns deleting half a large array into O(n²)).
            let writeIndex = 0;
            let deleteCursor = 0;
            for (let readIndex = 0; readIndex < items.length; readIndex++) {
                if (deleteCursor < deleteIndices.length && deleteIndices[deleteCursor] === readIndex) {
                    deleteCursor++;
                    continue;
                }
                items[writeIndex++] = items[readIndex];
            }
            items.length = writeIndex;
        }
        for (const idx of deleteIndices) {
            if (params.options.trackOperations !== false)
                params.stats.operations.push(`delete_element at ${idx}`);
        }
    }
    if (relativeInsert) {
        const { data, position, key } = relativeInsert;
        for (const node of results) {
            if (!params.options.dryRun && !(0, ops_1.insertRelative)(node, data, position, key, params.options, params.stats)) {
                continue;
            }
            params.stats.inserted++;
            if (params.options.trackOperations !== false) {
                params.stats.operations.push(`insert ${position} ${typeof key === 'number' ? `index=${key}` : (key ?? '')}`);
            }
        }
    }
    return {
        data: workingData,
        results,
        immutableApplied: params.immutableApplied || shouldClone,
    };
}
function canUseFlatArrayFastPath(params) {
    if (!Array.isArray(params.data))
        return false;
    if (params.criteria.length === 0 || params.actions.length === 0)
        return false;
    if (params.options.includeArrays === false)
        return false;
    if ((params.options.maxDepth ?? 10) < 1)
        return false;
    if (params.criteria.some((criterion) => criterion.isDeep))
        return false;
    if (hasNestedCriterionCandidate(params.data, params.criteria, params.options))
        return false;
    return params.actions.every((action) => (0, actions_1.isValueAction)(action.type) || action.type === 'delete_element') ||
        getRelativeInsert(params.actions) !== null;
}
function getRelativeInsert(actions) {
    if (actions.length !== 1 || actions[0]?.type !== 'insert')
        return null;
    const action = actions[0];
    return action.position === 'before' || action.position === 'after' ? action : null;
}
/**
 * True when any nested descendant (beyond the top-level items) could match the
 * criteria heads — the signal that a flat scan would diverge from full DFS.
 * Shared with pipeline-fastpath.ts so both fast paths bail out identically.
 */
function hasNestedCriterionCandidate(items, criteria, options) {
    const maxDepth = options.maxDepth ?? 10;
    if (maxDepth <= 1)
        return false;
    const firstSegments = [];
    for (const criterion of criteria) {
        const firstSegment = criterion.segments[0];
        if (firstSegment === undefined)
            return true;
        firstSegments.push(firstSegment);
    }
    const includeArrays = !!options.includeArrays;
    const includeObjects = !!options.includeObjects;
    const nodes = [];
    const depths = [];
    for (let index = items.length - 1; index >= 0; index--) {
        pushChildContainers(items[index], 1, maxDepth, includeArrays, includeObjects, nodes, depths);
    }
    while (nodes.length > 0) {
        const node = nodes.pop();
        const depth = depths.pop();
        if (canNodeMatchCriterionHead(node, firstSegments)) {
            return true;
        }
        pushChildContainers(node, depth, maxDepth, includeArrays, includeObjects, nodes, depths);
    }
    return false;
}
function pushChildContainers(node, depth, maxDepth, includeArrays, includeObjects, nodes, depths) {
    if (depth >= maxDepth)
        return;
    const nextDepth = depth + 1;
    if (Array.isArray(node) && includeArrays) {
        for (let index = node.length - 1; index >= 0; index--) {
            const child = node[index];
            if (!(0, utils_1.isObject)(child))
                continue;
            nodes.push(child);
            depths.push(nextDepth);
        }
        return;
    }
    if ((0, utils_1.isObject)(node) && includeObjects) {
        const obj = node;
        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                const child = obj[key];
                if (!(0, utils_1.isObject)(child))
                    continue;
                nodes.push(child);
                depths.push(nextDepth);
            }
        }
    }
}
function canNodeMatchCriterionHead(node, firstSegments) {
    for (let index = 0; index < firstSegments.length; index++) {
        const firstSegment = firstSegments[index];
        if (Array.isArray(node)) {
            const itemIndex = Number(firstSegment);
            if (!Number.isNaN(itemIndex) && itemIndex >= 0 && itemIndex < node.length) {
                return true;
            }
            continue;
        }
        if ((0, utils_1.isObject)(node) && firstSegment in node) {
            return true;
        }
    }
    return false;
}
//# sourceMappingURL=flat-array-fast-path.js.map