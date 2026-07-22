"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setCompiledMutationCacheLimit = setCompiledMutationCacheLimit;
exports.clearCompiledMutationCache = clearCompiledMutationCache;
exports.isFlatMutationCodegenable = isFlatMutationCodegenable;
exports.compileFlatMutation = compileFlatMutation;
const compiled_predicate_1 = require("./compiled-predicate");
const operators_registry_1 = require("./operators-registry");
const data_engine_1 = require("./data-engine");
let canCompile = null;
function compilationAvailable() {
    if (canCompile !== null)
        return canCompile;
    try {
        new Function('return true');
        canCompile = true;
    }
    catch {
        canCompile = false;
    }
    return canCompile;
}
const factoryCache = new Map();
let cacheMax = 2000;
function setCompiledMutationCacheLimit(limit) { cacheMax = Math.max(0, limit | 0); }
function clearCompiledMutationCache() { factoryCache.clear(); }
function actionIsCodegenable(a) {
    if (a.type === 'update' || a.type === 'replace') {
        const key = a.key;
        const value = a.value;
        if (typeof key !== 'string' || key.length === 0 || typeof value === 'function')
            return false;
        return (0, data_engine_1.createJsonPathPlan)(key).segments.length === 1;
    }
    if (a.type === 'delete_key') {
        const key = a.key;
        if (typeof key !== 'string' || key.length === 0)
            return false;
        return (0, data_engine_1.createJsonPathPlan)(key).segments.length === 1;
    }
    if (a.type === 'merge_update') {
        const key = a.key;
        if (typeof key !== 'string' || key.length === 0 || a.deep === true)
            return false;
        return (0, data_engine_1.createJsonPathPlan)(key).segments.length === 1;
    }
    return false;
}
function criteriaAreCodegenable(criteria) {
    if (criteria.length === 0)
        return false;
    for (const c of criteria) {
        if (c.isDeep)
            return false;
        if (c.segments.length !== 1)
            return false;
        if (c.segments[0] === undefined)
            return false;
        if (!(0, operators_registry_1.isOperatorKnown)(String(c.operator)))
            return false;
        if ((0, compiled_predicate_1.opExpr)(String(c.operator), 'a', 'b') === null)
            return false;
    }
    return true;
}
function isFlatMutationCodegenable(criteria, actions) {
    if (!compilationAvailable())
        return false;
    if (!criteriaAreCodegenable(criteria))
        return false;
    if (actions.length === 0)
        return false;
    for (const a of actions) {
        if (!actionIsCodegenable(a))
            return false;
    }
    return true;
}
function statKeyForAction(type) {
    switch (type) {
        case 'update': return 'updates';
        case 'replace': return 'replaces';
        case 'delete_key': return 'deletedKeys';
        case 'merge_update': return 'mergeUpdates';
        default: return null;
    }
}
function buildFactory(criteria, actions) {
    const valueCount = criteria.length;
    const predicateParts = [];
    for (let i = 0; i < criteria.length; i++) {
        const key = JSON.stringify(criteria[i].segments[0]);
        const expr = (0, compiled_predicate_1.opExpr)(String(criteria[i].operator), `it[${key}]`, `vals[${i}]`);
        predicateParts.push(`((${key} in it) && (${expr}))`);
    }
    const predicate = predicateParts.join(' && ');
    const actionLines = [];
    const statIncrements = [];
    const operationPushes = [];
    for (let i = 0; i < actions.length; i++) {
        const a = actions[i];
        const key = JSON.stringify(a.key);
        const statKey = statKeyForAction(a.type);
        if (!statKey)
            return null;
        if (a.type === 'delete_key') {
            operationPushes.push(`if (opts.trackOperations !== false) stats.operations.push('delete_key ' + ${key});`);
            statIncrements.push(`stats.${String(statKey)}++;`);
            actionLines.push(`if (opts.strictPathsWarn && !Object.prototype.hasOwnProperty.call(target, ${key})) stats.warnings.push("delete_key: path '" + ${key} + "' did not exist");`, `if (!opts.dryRun) delete target[${key}];`);
        }
        else if (a.type === 'merge_update') {
            const patch = `vals[${valueCount + i}]`;
            const current = `current${i}`;
            operationPushes.push(`if (opts.trackOperations !== false) stats.operations.push('merge_update ' + ${key});`);
            statIncrements.push(`stats.${String(statKey)}++;`);
            actionLines.push(`if (opts.strictPathsWarn && !Object.prototype.hasOwnProperty.call(target, ${key})) stats.warnings.push("merge_update: path '" + ${key} + "' did not exist; created implicitly");`, `if (!opts.dryRun) { var ${current} = target[${key}]; target[${key}] = (${current} !== null && typeof ${current} === 'object' && ${patch} !== null && typeof ${patch} === 'object') ? Object.assign({}, ${current}, ${patch}) : ${patch}; }`);
        }
        else {
            operationPushes.push(`if (opts.trackOperations !== false) stats.operations.push('${a.type} ' + ${key});`);
            statIncrements.push(`stats.${String(statKey)}++;`);
            actionLines.push(`if (opts.strictPathsWarn && !Object.prototype.hasOwnProperty.call(target, ${key})) stats.warnings.push("${a.type}: path '" + ${key} + "' did not exist; created implicitly");`, `if (!opts.dryRun) target[${key}] = vals[${valueCount + i}];`);
        }
    }
    const source = [
        `var results = [];`,
        `var needPaths = opts.needPaths;`,
        `var collectResults = opts.collectResults !== false;`,
        `var immutable = opts.immutable;`,
        `var dryRun = opts.dryRun;`,
        `var mutated = 0;`,
        `for (var i = 0; i < items.length; i++) {`,
        `  var it = items[i];`,
        `  if (it === null || typeof it !== 'object') continue;`,
        `  if (!(${predicate})) continue;`,
        `  stats.resultsFound++;`,
        ...statIncrements.map((l) => `  ${l}`),
        ...operationPushes.map((l) => `  ${l}`),
        `  var target = immutable && !dryRun ? opts.clone(it) : it;`,
        ...actionLines.map((l) => `  ${l}`),
        `  if (immutable && !dryRun) items[i] = target;`,
        `  if (collectResults && needPaths) results.push({ data: target, path: [String(i)], depth: 1, parent: items, parentKey: i });`,
        `  else if (collectResults) results.push({ data: target, depth: 1 });`,
        `  mutated++;`,
        `}`,
        `return results;`,
    ].join('\n');
    try {
        return new Function('items', 'vals', 'opts', 'stats', source);
    }
    catch {
        return null;
    }
}
function compileFlatMutation(criteria, actions) {
    if (!isFlatMutationCodegenable(criteria, actions))
        return null;
    const sig = criteria.map((c) => `${c.segments[0]}\x01${c.operator}`).join('\x02') +
        '\x03' +
        actions.map((a) => {
            const key = a.key;
            if (a.type === 'update' || a.type === 'replace') {
                return `${a.type}\x01${key}`;
            }
            return `${a.type}\x01${key}`;
        }).join('\x02');
    let factory = factoryCache.get(sig);
    if (factory === undefined) {
        factory = buildFactory(criteria, actions);
        if (factoryCache.size >= cacheMax)
            factoryCache.clear();
        factoryCache.set(sig, factory);
    }
    if (!factory)
        return null;
    const vals = [
        ...criteria.map((c) => c.value),
        ...actions.map((a) => a.type === 'merge_update'
            ? a.patch
            : a.value),
    ];
    return ((items, opts, stats) => factory(items, vals, opts, stats));
}
//# sourceMappingURL=compiled-mutation.js.map