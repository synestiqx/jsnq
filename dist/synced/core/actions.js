import { createJsonPathPlan, deleteJsonPath, getJsonBySegments, hasJsonPath, writeJsonPath, } from './data-engine.js';
import { deepMerge, isObject } from './utils.js';
const VALUE_STATS = {
    replace: 'replaces',
    update: 'updates',
    merge_update: 'mergeUpdates',
    delete_key: 'deletedKeys',
};
export function isValueAction(type) {
    return type in VALUE_STATS;
}
export function prepareAction(action) {
    if (!isValueAction(action.type))
        return { action, plan: null, single: null };
    const key = action.key;
    const plan = createJsonPathPlan(key);
    return {
        action,
        plan,
        single: plan.segments.length === 1 ? plan.segments[0] : null,
    };
}
export function prepareActions(actions) {
    return actions.map(prepareAction);
}
function readPrepared(target, prepared) {
    if (prepared.single !== null && target != null) {
        return target[prepared.single];
    }
    return getJsonBySegments(target, prepared.plan.segments);
}
function preparedPathExists(target, prepared) {
    if (prepared.single !== null) {
        return target != null && typeof target === 'object' &&
            Object.prototype.hasOwnProperty.call(target, prepared.single);
    }
    return hasJsonPath(target, prepared.plan);
}
function writePrepared(target, prepared, value) {
    if (prepared.single !== null && target != null && typeof target === 'object' && !Array.isArray(target)) {
        target[prepared.single] = value;
        return;
    }
    writeJsonPath(target, prepared.plan, value);
}
function deletePrepared(target, prepared) {
    if (prepared.single !== null && target != null && typeof target === 'object' && !Array.isArray(target)) {
        delete target[prepared.single];
        return;
    }
    deleteJsonPath(target, prepared.plan);
}
export function computeMergedValue(current, action, options) {
    if (!isObject(current) || !isObject(action.patch))
        return action.patch;
    if (action.deep === true) {
        return deepMerge(current, action.patch, { arrayStrategy: options.arrayMergeStrategy, arrayKey: options.arrayMergeKey });
    }
    return { ...current, ...action.patch };
}
function warnImplicitPath(target, prepared, options, stats, message) {
    if (options.strictPathsWarn && !preparedPathExists(target, prepared))
        stats.warnings.push(message);
}
/**
 * Apply a prepared value action to `target`. Returns false when the action is
 * not a value action (caller handles structural actions itself).
 */
export function applyValueAction(target, prepared, options, stats) {
    const action = prepared.action;
    const key = prepared.plan?.path ?? '';
    switch (action.type) {
        case 'replace':
        case 'update': {
            const act = action;
            const next = typeof act.value === 'function'
                ? act.value(readPrepared(target, prepared), target)
                : act.value;
            warnImplicitPath(target, prepared, options, stats, `${action.type}: path '${key}' did not exist; created implicitly`);
            if (!options.dryRun)
                writePrepared(target, prepared, next);
            stats[VALUE_STATS[action.type]]++;
            if (options.trackOperations !== false)
                stats.operations.push(`${action.type} ${key}`);
            return true;
        }
        case 'merge_update': {
            const act = action;
            const merged = computeMergedValue(readPrepared(target, prepared), act, options);
            warnImplicitPath(target, prepared, options, stats, `merge_update: path '${key}' did not exist; created implicitly`);
            if (!options.dryRun)
                writePrepared(target, prepared, merged);
            stats.mergeUpdates++;
            if (options.trackOperations !== false)
                stats.operations.push(`merge_update ${key}${act.deep === true ? ' (deep)' : ''}`);
            return true;
        }
        case 'delete_key': {
            warnImplicitPath(target, prepared, options, stats, `delete_key: path '${key}' did not exist`);
            if (!options.dryRun)
                deletePrepared(target, prepared);
            stats.deletedKeys++;
            if (options.trackOperations !== false)
                stats.operations.push(`delete_key ${key}`);
            return true;
        }
        default:
            return false;
    }
}
//# sourceMappingURL=actions.js.map