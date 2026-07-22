"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assignWithPolicy = assignWithPolicy;
exports.getAssignmentEffect = getAssignmentEffect;
exports.canRemoveFromOriginal = canRemoveFromOriginal;
exports.removeFromOriginal = removeFromOriginal;
exports.assertCanInsertIntoTargetPath = assertCanInsertIntoTargetPath;
exports.canInsertIntoResolvedTarget = canInsertIntoResolvedTarget;
exports.wouldCreateMoveCycle = wouldCreateMoveCycle;
exports.wouldCreateMoveCycleAtPath = wouldCreateMoveCycleAtPath;
exports.insertRelative = insertRelative;
exports.canInsertRelative = canInsertRelative;
exports.insertIntoTargetPath = insertIntoTargetPath;
exports.selectTargets = selectTargets;
exports.fanoutMatchesToTargets = fanoutMatchesToTargets;
exports.orderMatchesForMove = orderMatchesForMove;
const utils_1 = require("./utils");
const operators_registry_1 = require("./operators-registry");
const match_1 = require("./match");
const compiled_predicate_1 = require("./compiled-predicate");
const path_safety_1 = require("../../utils/path-safety");
function assignWithPolicy(target, key, value, options, stats, errorFactory) {
    const effect = getAssignmentEffect(target, key, options, errorFactory);
    const keyStr = String(key);
    const exists = keyStr in target;
    if (options?.warnOnOverwrite !== false && exists) {
        stats?.warnings.push(`overwrite at key '${keyStr}'`);
    }
    if (effect === 'skip')
        return false;
    target[keyStr] = value;
    return true;
}
function getAssignmentEffect(target, key, options, errorFactory) {
    const keyStr = String(key);
    if ((0, path_safety_1.isForbiddenPathSegment)(keyStr)) {
        throw new Error(`Unsafe object key '${keyStr}'`);
    }
    return resolveOverwriteEffect(keyStr in target, keyStr, options, errorFactory);
}
function resolveOverwriteEffect(exists, conflictKey, options, errorFactory) {
    const policy = options?.overwritePolicy ?? 'overwrite';
    if (exists) {
        if (policy === 'skip')
            return 'skip';
        if (policy === 'error')
            throw errorFactory(conflictKey);
    }
    return 'write';
}
function assignPathWithPolicy(target, path, value, options, stats, errorFactory) {
    const effect = getPathAssignmentEffect(target, path, options, errorFactory);
    const exists = (0, utils_1.hasPath)(target, path);
    if (options?.warnOnOverwrite !== false && exists) {
        stats?.warnings.push(`overwrite at key '${path}'`);
    }
    if (effect === 'skip')
        return false;
    (0, utils_1.setByPath)(target, path, value);
    return true;
}
function getPathAssignmentEffect(target, path, options, errorFactory) {
    return resolveOverwriteEffect((0, utils_1.hasPath)(target, path), path, options, errorFactory);
}
const insertConflictError = (conflictKey) => new Error(`insert overwrite prevented for key '${conflictKey}'`);
/** Assign `value` at `key` on an object target, routing dotted keys through path assignment. */
function assignKeyOrPath(target, key, value, options, stats) {
    return key.includes('.')
        ? assignPathWithPolicy(target, key, value, options, stats, insertConflictError)
        : assignWithPolicy(target, key, value, options, stats, insertConflictError);
}
function canAssignKeyOrPath(target, key, options) {
    const effect = key.includes('.')
        ? getPathAssignmentEffect(target, key, options, insertConflictError)
        : getAssignmentEffect(target, key, options, insertConflictError);
    return effect === 'write';
}
/**
 * Remove the current node from its original parent container.
 */
function canRemoveFromOriginal(node) {
    if (!node || node.parent === undefined || node.parent === null || node.parentKey === undefined)
        return false;
    const parent = node.parent;
    if (Array.isArray(parent)) {
        if (typeof node.parentKey === 'number') {
            const idx = node.parentKey;
            if (!Number.isNaN(idx) && idx >= 0 && idx < parent.length && parent[idx] === node.data) {
                return true;
            }
        }
        return parent.indexOf(node.data) >= 0;
    }
    if ((0, utils_1.isRecordObject)(parent)) {
        const obj = parent;
        const k = node.parentKey;
        return Object.prototype.hasOwnProperty.call(obj, k) && obj[k] === node.data;
    }
    return false;
}
/** Remove only when the captured parent still owns this exact node. */
function removeFromOriginal(node) {
    if (!canRemoveFromOriginal(node))
        return false;
    const parent = node.parent;
    if (Array.isArray(parent)) {
        const hinted = typeof node.parentKey === 'number' ? node.parentKey : -1;
        const index = hinted >= 0 && parent[hinted] === node.data ? hinted : parent.indexOf(node.data);
        if (index < 0)
            return false;
        parent.splice(index, 1);
        return true;
    }
    delete parent[node.parentKey];
    return true;
}
function assertCanInsertIntoTargetPath(root, positionPath, mode = 'inside', key) {
    const resolved = (0, utils_1.resolveTargetPath)(root, positionPath, false);
    const { targetNode, targetParent } = resolved;
    const pos = mode ?? 'inside';
    if (pos === 'inside') {
        if (Array.isArray(targetNode))
            return resolved;
        if ((0, utils_1.isRecordObject)(targetNode)) {
            if (typeof key !== 'string') {
                throw new Error("insert_to/moveTo/copyTo: explicit string 'key' is required when inserting into an object target (inside)");
            }
            return resolved;
        }
        throw new Error(`insert_to/moveTo/copyTo: target path '${positionPath}' is not insertable`);
    }
    if (Array.isArray(targetParent))
        return resolved;
    if ((0, utils_1.isRecordObject)(targetParent)) {
        if (typeof key !== 'string') {
            throw new Error("insert_to/moveTo/copyTo: explicit string 'key' is required when inserting before/after an object key");
        }
        return resolved;
    }
    throw new Error(`insert_to/moveTo/copyTo: target path '${positionPath}' has no insertable parent`);
}
/** Preflight overwrite policy and relative-target availability before source removal. */
function canInsertIntoResolvedTarget(resolved, data, mode = 'inside', key, options) {
    const { targetNode, targetParent, targetKey } = resolved;
    if (mode === 'inside') {
        if (Array.isArray(targetNode))
            return true;
        if (!(0, utils_1.isRecordObject)(targetNode) || typeof key !== 'string')
            return false;
        if (!key.includes('.') && Array.isArray(targetNode[key]))
            return true;
        return canAssignKeyOrPath(targetNode, key, options);
    }
    if (Array.isArray(targetParent)) {
        if (typeof targetKey === 'number' && (targetNode === undefined || targetNode === null))
            return true;
        return targetParent.indexOf(targetNode) >= 0;
    }
    return (0, utils_1.isRecordObject)(targetParent) && typeof targetKey === 'string' && typeof key === 'string'
        ? canAssignKeyOrPath(targetParent, key, options)
        : false;
}
function containsObjectReference(root, candidate) {
    if (!(0, utils_1.isObject)(root) || !(0, utils_1.isObject)(candidate))
        return false;
    const stack = [root];
    const seen = new WeakSet();
    while (stack.length > 0) {
        const current = stack.pop();
        if (current === candidate)
            return true;
        if (seen.has(current))
            continue;
        seen.add(current);
        if (Array.isArray(current)) {
            for (let i = 0; i < current.length; i++) {
                if ((0, utils_1.isObject)(current[i]))
                    stack.push(current[i]);
            }
        }
        else {
            const values = Object.values(current);
            for (let i = 0; i < values.length; i++) {
                if ((0, utils_1.isObject)(values[i]))
                    stack.push(values[i]);
            }
        }
    }
    return false;
}
/** True when inserting `source` at `target` would attach it below itself. */
function wouldCreateMoveCycle(source, target, mode = 'inside') {
    if (!(0, utils_1.isObject)(source))
        return false;
    const targetNode = 'targetNode' in target ? target.targetNode : target.data;
    const targetParent = 'targetParent' in target ? target.targetParent : target.parent;
    if (targetNode === source)
        return true;
    const container = mode === 'inside' ? targetNode : targetParent;
    if (containsObjectReference(source, container))
        return true;
    // A missing path resolves to a detached placeholder. Its existing parent still
    // reveals whether path creation would happen below the source.
    return mode === 'inside' && containsObjectReference(source, targetParent);
}
/** O(path depth) cycle guard for moveTo(path), including aliased source branches. */
function wouldCreateMoveCycleAtPath(root, source, positionPath) {
    if (!(0, utils_1.isObject)(source))
        return false;
    const segments = (0, utils_1.splitPath)(positionPath);
    let node = root;
    if (node === source)
        return true;
    for (let i = 0; i < segments.length; i++) {
        if (Array.isArray(node)) {
            const index = Number(segments[i]);
            if (!Number.isInteger(index) || index < 0 || index >= node.length)
                return false;
            node = node[index];
        }
        else if ((0, utils_1.isRecordObject)(node)) {
            const key = segments[i];
            if (!Object.prototype.hasOwnProperty.call(node, key))
                return false;
            node = node[key];
        }
        else {
            return false;
        }
        if (node === source)
            return true;
    }
    return false;
}
/**
 * Insert data relative to a reference node (inside/before/after).
 */
function insertRelative(ref, data, position = 'inside', key, options, stats) {
    if (!ref)
        return false;
    if (position === 'inside') {
        if (Array.isArray(ref.data)) {
            if (typeof key === 'number') {
                const idx = Math.max(0, Math.min(ref.data.length, key));
                ref.data.splice(idx, 0, data);
            }
            else {
                ref.data.push(data);
            }
            return true;
        }
        else if ((0, utils_1.isRecordObject)(ref.data)) {
            // INSIDE on object:
            // - if explicit string key provided and points to array -> push to that array
            // - if explicit string key provided -> set normally (supports dotted path)
            // - if no key provided and data is object -> merge properties into found object (no auto/random key)
            // - if no key provided and data is non-object -> skip with warning (cannot infer key)
            if (typeof key === 'string') {
                const existingValue = key.includes('.') ? undefined : ref.data[key];
                if (Array.isArray(existingValue)) {
                    existingValue.push(data);
                    return true;
                }
                else {
                    return assignKeyOrPath(ref.data, key, data, options, stats);
                }
            }
            else if ((0, utils_1.isRecordObject)(data)) {
                // Merge object properties into the target object (preserving reference)
                const merged = (0, utils_1.deepMerge)(ref.data, data, {
                    arrayStrategy: options?.arrayMergeStrategy,
                    arrayKey: options?.arrayMergeKey,
                });
                const rec = ref.data;
                for (const k of Object.keys(rec))
                    delete rec[k];
                Object.assign(rec, merged);
                return true;
            }
            else {
                stats?.warnings.push?.('insert inside object without key ignored for non-object payload');
                return false;
            }
        }
        return false;
    }
    const parent = ref.parent;
    if (!parent)
        return false;
    if (Array.isArray(parent)) {
        // IMPORTANT: Always use indexOf for arrays because parentKey may be stale after previous removeFromOriginal
        const actualIdx = parent.indexOf(ref.data);
        if (actualIdx !== -1) {
            if (position === 'before')
                parent.splice(actualIdx, 0, data);
            else
                parent.splice(actualIdx + 1, 0, data);
            return true;
        }
    }
    else if ((0, utils_1.isRecordObject)(parent)) {
        // For before/after relative to an object key: require explicit key, do not auto-generate
        if (options?.objectOrderWarning !== false) {
            stats?.warnings.push?.('before/after on object: property order is not semantically stable in JS');
        }
        if (typeof key !== 'string' || key.length === 0) {
            stats?.warnings.push?.('before/after on object requires explicit string key; operation skipped');
            return false;
        }
        return assignKeyOrPath(parent, key, data, options, stats);
    }
    return false;
}
function canInsertRelative(ref, data, position = 'inside', key, options) {
    if (!ref)
        return false;
    if (position === 'inside') {
        if (Array.isArray(ref.data))
            return true;
        if ((0, utils_1.isRecordObject)(ref.data)) {
            if (typeof key === 'string') {
                if (!key.includes('.') && Array.isArray(ref.data[key]))
                    return true;
                return canAssignKeyOrPath(ref.data, key, options);
            }
            return (0, utils_1.isRecordObject)(data);
        }
        return false;
    }
    const parent = ref.parent;
    if (!parent)
        return false;
    if (Array.isArray(parent)) {
        return parent.indexOf(ref.data) !== -1;
    }
    if (!(0, utils_1.isRecordObject)(parent) || typeof key !== 'string' || key.length === 0)
        return false;
    return canAssignKeyOrPath(parent, key, options);
}
/**
 * Insert the given data into a target path on the root, supporting inside/before/after semantics.
 * Mirrors the logic previously embedded in pipeline for move/copy/insert_to.
 */
function insertIntoTargetPath(root, positionPath, data, mode = 'inside', resolver, key, options, stats) {
    const { targetNode, targetParent, targetKey } = resolver(root, positionPath);
    const pos = mode ?? 'inside';
    if (pos === 'inside') {
        if (Array.isArray(targetNode)) {
            if (typeof key === 'number') {
                const idx = Math.max(0, Math.min(targetNode.length, key));
                targetNode.splice(idx, 0, data);
            }
            else {
                targetNode.push(data);
            }
        }
        else if ((0, utils_1.isRecordObject)(targetNode)) {
            if (typeof key !== 'string') {
                throw new Error("insert_to/moveTo/copyTo: explicit string 'key' is required when inserting into an object target (inside)");
            }
            const existingValue = key.includes('.') ? undefined : targetNode[key];
            if (Array.isArray(existingValue)) {
                existingValue.push(data);
            }
            else {
                assignKeyOrPath(targetNode, key, data, options, stats);
            }
        }
        return;
    }
    if (!targetParent)
        return;
    if (Array.isArray(targetParent)) {
        if (typeof targetKey === 'number' && (targetNode === undefined || targetNode === null)) {
            const idx = Math.max(0, Math.min(targetParent.length, targetKey));
            if (pos === 'before')
                targetParent.splice(idx, 0, data);
            else
                targetParent.splice(Math.min(idx + 1, targetParent.length), 0, data);
        }
        else {
            const idx = targetParent.indexOf(targetNode);
            if (idx !== -1) {
                if (pos === 'before')
                    targetParent.splice(idx, 0, data);
                else
                    targetParent.splice(idx + 1, 0, data);
            }
        }
    }
    else if ((0, utils_1.isRecordObject)(targetParent) && typeof targetKey === 'string') {
        if (typeof key !== 'string') {
            throw new Error("insert_to/moveTo/copyTo: explicit string 'key' is required when inserting before/after an object key");
        }
        assignKeyOrPath(targetParent, key, data, options, stats);
    }
}
// Select potential target nodes based on a criterion evaluated against each traversed node
function selectTargets(root, options, targetKey, targetOperator, targetValue, buildMeta = true) {
    const targets = [];
    const segs = (0, utils_1.splitPath)(targetKey);
    const opFn = (0, operators_registry_1.getOperatorFn)(targetOperator);
    // Compile the target criterion when it is a simple single-segment, non-deep test
    // so target selection pays the same per-node cost as the flat-array fast path.
    const targetCriterion = segs.length === 1 ? (0, match_1.compileCriterion)(targetKey, targetOperator, targetValue) : null;
    const targetPred = targetCriterion ? (0, compiled_predicate_1.compileCriteriaPredicate)([targetCriterion]) : null;
    // Absolute path mode: targetKey begins with '$' (e.g., '$.a.b[0].items')
    // In this mode we select nodes whose path from root equals the given absolute path.
    if (typeof targetKey === 'string' && targetKey.startsWith('$')) {
        const abs = targetKey.startsWith('$.') ? targetKey.slice(2) : targetKey.slice(1);
        const absSegs = (0, utils_1.splitPath)(abs);
        const hasWildcard = absSegs.some((seg) => seg.includes('*'));
        if (!hasWildcard) {
            const pathExists = absSegs.length === 0 ? true : (0, utils_1.hasPath)(root, abs);
            if (!pathExists) {
                return targets;
            }
            const node = absSegs.length === 0 ? root : (0, utils_1.getBySegments)(root, absSegs);
            const parentSegs = absSegs.slice(0, -1);
            const parent = parentSegs.length ? (0, utils_1.getBySegments)(root, parentSegs) : undefined;
            const rawKey = absSegs[absSegs.length - 1];
            const parentKey = rawKey !== undefined && /^\d+$/.test(rawKey) ? Number(rawKey) : rawKey;
            targets.push({
                data: node,
                path: absSegs,
                depth: absSegs.length,
                parent,
                parentKey: parentKey,
            });
            return targets;
        }
        for (const n of (0, utils_1.dfsIterator)(root, {
            maxDepth: options.maxDepth ?? 10,
            includeArrays: !!options.includeArrays,
            includeObjects: !!options.includeObjects,
            buildMeta: true,
            returnPaths: true,
        })) {
            const p = n.path;
            if (p && p.length === absSegs.length && p.every((v, i) => absSegs[i] === '*' || v === absSegs[i])) {
                targets.push(n);
            }
        }
        return targets;
    }
    (0, utils_1.scanJsonMatches)(root, {
        maxDepth: options.maxDepth ?? 10,
        includeArrays: !!options.includeArrays,
        includeObjects: !!options.includeObjects,
        buildMeta,
        returnPaths: false
    }, (node) => targetPred ? targetPred(node) : opFn((0, utils_1.getBySegments)(node, segs), targetValue), (n) => {
        targets.push(n);
    });
    return targets;
}
// Choose key per context: explicit > (inside object: source key or id) > (before/after on object: id or source key)
function chooseEffectiveKey(src, target, pos, key) {
    if (key !== undefined)
        return key;
    const srcKey = typeof src.parentKey === 'string' ? src.parentKey : undefined;
    const idKey = getDefaultIdKey(src.data);
    if (pos === 'inside' && (0, utils_1.isRecordObject)(target.data))
        return srcKey ?? idKey;
    if (pos !== 'inside' && (0, utils_1.isRecordObject)(target.parent))
        return idKey ?? srcKey;
    return undefined;
}
function getPlannedObjectSlot(target, pos, key) {
    if (typeof key !== 'string')
        return null;
    if (pos === 'inside' && (0, utils_1.isRecordObject)(target.data)) {
        if (!key.includes('.') && Array.isArray(target.data[key]))
            return null;
        return { owner: target.data, key };
    }
    if (pos !== 'inside' && (0, utils_1.isRecordObject)(target.parent)) {
        return { owner: target.parent, key };
    }
    return null;
}
// Fan-out helper for move/copy matches into targets
function fanoutMatchesToTargets(kind, matches, targets, mode = 'inside', key, options, stats, dryRun = false) {
    const pos = mode ?? 'inside';
    const plans = [];
    const reservedSlots = new WeakMap();
    let applied = 0;
    for (const src of matches) {
        if (kind === 'move' && !canRemoveFromOriginal(src)) {
            stats?.warnings.push?.('move_matches: source is not attached to a removable parent; source left in place');
            continue;
        }
        const plannedTargets = [];
        for (const t of targets) {
            if (kind === 'move' && wouldCreateMoveCycle(src.data, t, pos))
                continue;
            const effectiveKey = chooseEffectiveKey(src, t, pos, key);
            // Match fan-out into an object follows the explicit-key/id contract. The
            // keyless object merge remains available to the standalone insert operator.
            const hasObjectKey = pos !== 'inside' || !(0, utils_1.isRecordObject)(t.data) || effectiveKey !== undefined;
            if (!hasObjectKey || !canInsertRelative(t, src.data, pos, effectiveKey, options))
                continue;
            const slot = getPlannedObjectSlot(t, pos, effectiveKey);
            if (slot) {
                let keys = reservedSlots.get(slot.owner);
                if (!keys)
                    reservedSlots.set(slot.owner, keys = new Set());
                if (keys.has(slot.key)) {
                    const policy = options?.overwritePolicy ?? 'overwrite';
                    if (policy === 'error')
                        throw insertConflictError(slot.key);
                    if (policy === 'skip') {
                        if (options?.warnOnOverwrite !== false)
                            stats?.warnings.push(`overwrite at key '${slot.key}'`);
                        continue;
                    }
                }
                keys.add(slot.key);
            }
            plannedTargets.push({ target: t, effectiveKey });
        }
        if (kind === 'move' && plannedTargets.length === 0) {
            stats?.warnings.push?.('move_matches: no insertable targets; source left in place');
            continue;
        }
        plans.push({ src, targets: plannedTargets });
    }
    if (kind === 'move' && !dryRun) {
        for (const src of orderMatchesForMove(plans.map((plan) => plan.src))) {
            if (!removeFromOriginal(src)) {
                throw new Error('move_matches: source changed before it could be removed');
            }
        }
    }
    // Insert in original match order after all removals. This preserves source
    // ordering while retaining descending-index removal safety.
    for (const plan of plans) {
        for (let i = 0; i < plan.targets.length; i++) {
            const planned = plan.targets[i];
            if (dryRun) {
                applied++;
                continue;
            }
            // Every copy target owns its clone. A multi-target move keeps the original
            // in the first target and clones subsequent targets to avoid shared state.
            const element = kind === 'copy' || i > 0 ? (0, utils_1.cloneJson)(plan.src.data) : plan.src.data;
            if (insertRelative(planned.target, element, pos, planned.effectiveKey, options, stats))
                applied++;
        }
    }
    return applied;
}
// Ensure safe removal order for move operations: deeper nodes first, and for arrays by descending index
function orderMatchesForMove(matches) {
    return [...matches].sort((a, b) => {
        if (a.parent === b.parent) {
            const ai = typeof a.parentKey === 'number' ? a.parentKey : -1;
            const bi = typeof b.parentKey === 'number' ? b.parentKey : -1;
            if (ai !== -1 || bi !== -1)
                return bi - ai; // remove higher indexes first
        }
        return (b.depth ?? 0) - (a.depth ?? 0);
    });
}
function getDefaultIdKey(data) {
    if (data && typeof data === 'object') {
        const v = data['id'];
        if (typeof v === 'string' || typeof v === 'number')
            return String(v);
    }
    return undefined;
}
//# sourceMappingURL=ops.js.map