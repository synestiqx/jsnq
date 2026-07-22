"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JsnqPipeline = void 0;
const utils_1 = require("./utils");
const match_1 = require("./match");
const compiled_predicate_1 = require("./compiled-predicate");
const actions_1 = require("./actions");
const ops_1 = require("./ops");
const flat_array_fast_path_1 = require("./flat-array-fast-path");
// Actions that need parent/index metadata from the traversal to apply correctly.
const META_ACTIONS = new Set([
    'delete_element',
    'move',
    'move_matches',
    'move_matches_overwrite',
    'move_first_to_matches',
    'copy_matches',
    'copy_first_to_matches',
]);
// Global fan-out actions: move/copy all matches into selected targets.
const MATCH_FANOUT = {
    move_matches: { kind: 'move', allTargets: false },
    copy_matches: { kind: 'copy', allTargets: false },
    move_first_to_matches: { kind: 'move', allTargets: true },
    copy_first_to_matches: { kind: 'copy', allTargets: true },
};
class JsnqPipeline {
    _data;
    get data() { return this._data; }
    criteria;
    actions;
    options;
    stats = {
        searchTime: 0,
        nodesVisited: 0,
        resultsFound: 0,
        maxDepth: 0,
        replaces: 0,
        updates: 0,
        mergeUpdates: 0,
        deletedKeys: 0,
        deletedElements: 0,
        inserted: 0,
        moved: 0,
        copied: 0,
        warnings: [],
        operations: [],
    };
    warnedUnknownOps = new Set();
    strictCtx = { warnedUnknownOps: this.warnedUnknownOps, warnings: this.stats.warnings };
    immutableApplied = false;
    preparedActions = null;
    constructor(data, options = {}, criteria = [], actions = []) {
        this._data = data;
        this.options = {
            maxDepth: 10,
            includeArrays: true,
            includeObjects: true,
            earlyTermination: false,
            limit: undefined,
            buildMeta: true,
            returnPaths: true,
            ...options
        };
        this.criteria = criteria;
        this.actions = actions;
    }
    spawn(next) {
        return new JsnqPipeline(next.data ?? this.data, next.options ?? this.options, next.criteria ?? this.criteria, next.actions ?? this.actions);
    }
    with(next) {
        return this.spawn(next);
    }
    immutable(mode = true) {
        return this.with({ options: { ...this.options, immutable: mode } });
    }
    dryRun(enabled = true) {
        return this.with({ options: { ...this.options, dryRun: enabled } });
    }
    pipeline(...ops) { return this.pipe(...ops); }
    pipe(...ops) {
        return ops.reduce((acc, op) => op(acc), this);
    }
    clone() { return this.spawn({}); }
    first() {
        const limited = this.spawn({ options: { ...this.options, earlyTermination: true } });
        const res = limited.execute();
        return res.length ? res[0].data : null;
    }
    all() { return this.execute(); }
    count() { return this.execute().length; }
    getStats() {
        return {
            ...this.stats,
            warnings: [...this.stats.warnings],
            operations: [...this.stats.operations],
        };
    }
    actionsRequireMeta() {
        return this.actions.some((a) => META_ACTIONS.has(a.type) ||
            (a.type === 'insert' && !!a.position && a.position !== 'inside'));
    }
    getPreparedActions() {
        return this.preparedActions ??= (0, actions_1.prepareActions)(this.actions);
    }
    execute() {
        const now = () => (typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now());
        const t0 = now();
        Object.assign(this.stats, {
            searchTime: 0, nodesVisited: 0, resultsFound: 0, maxDepth: 0,
            replaces: 0, updates: 0, mergeUpdates: 0, deletedKeys: 0, deletedElements: 0,
            inserted: 0, moved: 0, copied: 0, warnings: [], operations: [],
        });
        this.strictCtx = { warnedUnknownOps: this.warnedUnknownOps, warnings: this.stats.warnings };
        // Enforce strict-operator policy once per execute() instead of once per visited node.
        // After this a compiled predicate can safely replace the interpreter for codegenable
        // non-deep criteria without losing warnings / throw semantics.
        for (let i = 0; i < this.criteria.length; i++) {
            (0, match_1.enforceKnownOperator)(this.criteria[i], this.options, this.strictCtx);
        }
        const compiledPred = !this.criteria.some((c) => c.isDeep)
            ? (0, compiled_predicate_1.compileCriteriaPredicate)(this.criteria)
            : null;
        const out = [];
        try {
            const needMeta = this.actionsRequireMeta(); // auto: only when actions truly need parent/index metadata
            const needPaths = this.options.returnPaths !== false && (this.options.buildMeta || this.actions.length > 0);
            const limit = this.options.limit ?? (this.options.earlyTermination ? 1 : undefined);
            // Immutable mode: clone data before traversal so iterator nodes point at the working copy.
            const shouldClone = (this.options.immutable === true) || (this.options.immutable === 'auto' && this.actions.length > 0);
            if (shouldClone && !this.immutableApplied) {
                this._data = (0, utils_1.cloneJson)(this.data);
                this.immutableApplied = true;
            }
            const rootArrayInsertFastPath = this.executeRootArrayInsertFastPath(needPaths);
            if (rootArrayInsertFastPath)
                return rootArrayInsertFastPath;
            const flatArrayFastPath = (0, flat_array_fast_path_1.executeFlatArrayFastPath)({
                data: this.data,
                criteria: this.criteria,
                actions: this.actions,
                options: this.options,
                stats: this.stats,
                warnedUnknownOps: this.warnedUnknownOps,
                immutableApplied: this.immutableApplied,
            });
            if (flatArrayFastPath) {
                this._data = flatArrayFastPath.data;
                this.immutableApplied = flatArrayFastPath.immutableApplied;
                return flatArrayFastPath.results;
            }
            // Check if we have deep criteria with arrayKey (requires special handling)
            const hasDeepArrayCriteria = this.criteria.some(c => c.isDeep && c.deepArrayKey);
            const seenDeepObjects = hasDeepArrayCriteria ? new WeakSet() : undefined;
            const seenDeepPathKeys = hasDeepArrayCriteria ? new Set() : undefined;
            if (this.actions.length === 0 && !needPaths && !this.criteria.some((c) => c.isDeep)) {
                return this.executeSearchOnlyFastPath(limit);
            }
            const preparedActions = this.actions.length > 0 ? this.getPreparedActions() : null;
            // Moving/copying while the DFS iterator is still walking the same graph can make
            // an inserted node visible to that iterator and apply the action twice. Collect
            // the stable match set first, then preserve the declared action order per match.
            const deferNodeActions = this.actions.some((action) => action.type === 'insert' || action.type === 'move' || action.type === 'copy');
            if (hasDeepArrayCriteria) {
                for (const node of (0, utils_1.dfsIterator)(this.data, {
                    maxDepth: this.options.maxDepth ?? 10,
                    includeArrays: !!this.options.includeArrays,
                    includeObjects: !!this.options.includeObjects,
                    buildMeta: needMeta,
                    returnPaths: needPaths,
                })) {
                    this.stats.nodesVisited++;
                    this.stats.maxDepth = Math.max(this.stats.maxDepth, node.depth);
                    // Special handling for deep array criteria
                    if (this.matchesSequential(node, out, seenDeepObjects, seenDeepPathKeys, !deferNodeActions)) {
                        if (limit && out.length >= limit)
                            break;
                    }
                }
            }
            else {
                const scan = (0, utils_1.scanJsonMatches)(this.data, {
                    maxDepth: this.options.maxDepth ?? 10,
                    includeArrays: !!this.options.includeArrays,
                    includeObjects: !!this.options.includeObjects,
                    buildMeta: needMeta,
                    returnPaths: needPaths,
                }, (node) => this.criteria.length === 0 || (compiledPred ? compiledPred(node) : (0, match_1.criteriaMatch)(this.criteria, node, this.options, this.strictCtx)), (node) => {
                    this.stats.resultsFound++;
                    if (preparedActions && !deferNodeActions)
                        this.applyActions(node, preparedActions);
                    out.push(node);
                    if (limit && out.length >= limit)
                        return false;
                });
                this.stats.nodesVisited += scan.nodesVisited;
                this.stats.maxDepth = Math.max(this.stats.maxDepth, scan.maxDepth);
            }
            if (preparedActions && deferNodeActions) {
                for (const node of out)
                    this.applyActions(node, preparedActions);
            }
            this.applyGlobalActions(out);
        }
        finally {
            this.stats.searchTime = now() - t0;
        }
        return out;
    }
    executeRootArrayInsertFastPath(needPaths) {
        if (!Array.isArray(this.data))
            return null;
        if (this.criteria.length !== 0 || this.actions.length !== 1)
            return null;
        const action = this.actions[0];
        if (!action || action.type !== 'insert')
            return null;
        const { data, position, key } = action;
        if (position !== 'inside')
            return null;
        if (!this.options.dryRun) {
            if (typeof key === 'number') {
                const index = Math.max(0, Math.min(this.data.length, key));
                this.data.splice(index, 0, data);
            }
            else {
                this.data.push(data);
            }
        }
        this.stats.nodesVisited++;
        this.stats.resultsFound++;
        this.stats.inserted++;
        if (this.options.trackOperations !== false)
            this.stats.operations.push('insert root-array inside');
        return [{
                data: data,
                path: needPaths ? [String(typeof key === 'number' ? key : Math.max(0, this.data.length - 1))] : undefined,
                depth: 1,
            }];
    }
    matchesSequential(node, out, seenDeepObjects, seenDeepPathKeys, applyActionsNow = true) {
        // Process criteria sequentially - each deep arrayKey criterion descends into nested elements
        let currentNodes = [node];
        for (let i = 0; i < this.criteria.length; i++) {
            const c = this.criteria[i];
            const nextNodes = [];
            for (const currentNode of currentNodes) {
                if (c.isDeep && c.deepArrayKey) {
                    // Deep array criterion - descend into nested elements
                    for (const deepNode of (0, utils_1.deepArrayIterator)(currentNode.data, c.deepArrayKey, c.segments, c.opFn, c.value, currentNode.path || [], currentNode.depth, this.options.maxDepth ?? 10)) {
                        nextNodes.push(deepNode);
                    }
                }
                else if (c.isDeep) {
                    // @id criterion - check current node
                    if (c.opFn((0, utils_1.getBySegments)(currentNode.data, c.segments), c.value)) {
                        nextNodes.push(currentNode);
                    }
                }
                else if ((0, match_1.criterionMatches)(c, currentNode.data)) {
                    nextNodes.push(currentNode);
                }
            }
            if (nextNodes.length === 0)
                return false;
            currentNodes = nextNodes;
        }
        // All criteria matched - process final nodes
        let emitted = false;
        for (const finalNode of currentNodes) {
            if (!this.markDeepResult(finalNode, seenDeepObjects, seenDeepPathKeys)) {
                continue;
            }
            this.stats.resultsFound++;
            if (applyActionsNow && this.actions.length > 0)
                this.applyActions(finalNode, this.getPreparedActions());
            out.push(finalNode);
            emitted = true;
        }
        return emitted;
    }
    markDeepResult(node, seenDeepObjects, seenDeepPathKeys) {
        if (!seenDeepObjects && !seenDeepPathKeys)
            return true;
        if ((0, utils_1.isObject)(node.data)) {
            if (seenDeepObjects?.has(node.data))
                return false;
            seenDeepObjects?.add(node.data);
            return true;
        }
        const pathKey = node.path?.join('\u0000') ?? `${node.depth}:${String(node.data)}`;
        if (seenDeepPathKeys?.has(pathKey))
            return false;
        seenDeepPathKeys?.add(pathKey);
        return true;
    }
    executeSearchOnlyFastPath(limit) {
        const out = [];
        const maxDepth = this.options.maxDepth ?? 10;
        const includeArrays = !!this.options.includeArrays;
        const includeObjects = !!this.options.includeObjects;
        // Codegen fast path: one compiled predicate replaces per-node operator indirection.
        // null (deep/multi-seg/custom-op/CSP) → keep the interpreter; results stay identical.
        const pred = (0, compiled_predicate_1.compileCriteriaPredicate)(this.criteria);
        // Top-level fast path: with maxDepth 1 an array root cannot be descended into, so the
        // full DFS would only ever check the root + its direct items. Iterate them directly —
        // no per-node stack frames, no child pushes — which is near-native for flat filtering.
        // (No nested-candidate guard needed: maxDepth 1 forbids descent by definition.)
        if (maxDepth === 1 && Array.isArray(this.data) && includeArrays) {
            const items = this.data;
            this.stats.maxDepth = Math.max(this.stats.maxDepth, 1);
            this.stats.nodesVisited++; // root array node
            // Hoist the pred/interpreter choice out of the loop so the per-item call site stays
            // monomorphic (no per-item closure indirection). Root checked first (depth 0).
            if (pred) {
                if (pred(items)) {
                    this.stats.resultsFound++;
                    out.push({ data: items, depth: 0 });
                    if (limit && out.length >= limit)
                        return out;
                }
                for (let i = 0; i < items.length; i++) {
                    this.stats.nodesVisited++;
                    const node = items[i];
                    if (pred(node)) {
                        this.stats.resultsFound++;
                        out.push({ data: node, depth: 1 });
                        if (limit && out.length >= limit)
                            break;
                    }
                }
            }
            else {
                if ((0, match_1.criteriaMatch)(this.criteria, items, this.options, this.strictCtx)) {
                    this.stats.resultsFound++;
                    out.push({ data: items, depth: 0 });
                    if (limit && out.length >= limit)
                        return out;
                }
                for (let i = 0; i < items.length; i++) {
                    this.stats.nodesVisited++;
                    const node = items[i];
                    if ((0, match_1.criteriaMatch)(this.criteria, node, this.options, this.strictCtx)) {
                        this.stats.resultsFound++;
                        out.push({ data: node, depth: 1 });
                        if (limit && out.length >= limit)
                            break;
                    }
                }
            }
            return out;
        }
        const nodes = [this.data];
        const depths = [0];
        while (nodes.length) {
            const node = nodes.pop();
            const depth = depths.pop();
            this.stats.nodesVisited++;
            if (depth > this.stats.maxDepth)
                this.stats.maxDepth = depth;
            if (pred ? pred(node) : (0, match_1.criteriaMatch)(this.criteria, node, this.options, this.strictCtx)) {
                this.stats.resultsFound++;
                out.push({ data: node, depth });
                if (limit && out.length >= limit)
                    break;
            }
            if (depth >= maxDepth)
                continue;
            const nextDepth = depth + 1;
            if (Array.isArray(node) && includeArrays) {
                for (let i = node.length - 1; i >= 0; i--) {
                    nodes.push(node[i]);
                    depths.push(nextDepth);
                }
            }
            else if ((0, utils_1.isObject)(node) && includeObjects) {
                const keys = Object.keys(node);
                for (let i = keys.length - 1; i >= 0; i--) {
                    nodes.push(node[keys[i]]);
                    depths.push(nextDepth);
                }
            }
        }
        return out;
    }
    applyMoveOrCopy(node, action, kind) {
        const { position, mode, key } = action;
        const isCopy = kind === 'copy';
        // Both operations share the same insertion contract. Validate before clone,
        // removal, path creation, or stats so an invalid copy cannot become a silent
        // no-op reported as successful.
        const validatedTarget = (0, ops_1.assertCanInsertIntoTargetPath)(this.data, position, mode, key);
        if (!(0, ops_1.canInsertIntoResolvedTarget)(validatedTarget, node.data, mode, key, this.options)) {
            if (this.options.warnOnOverwrite !== false)
                this.stats.warnings.push(`${kind}: target write skipped by overwrite policy`);
            return;
        }
        if (!isCopy) {
            if (!(0, ops_1.canRemoveFromOriginal)(node))
                throw new Error('move: source is not attached to a removable parent');
            if ((0, ops_1.wouldCreateMoveCycleAtPath)(this.data, node.data, position)) {
                throw new Error(`move: target path '${position}' is the source or one of its descendants`);
            }
        }
        if (!this.options.dryRun) {
            if (this.options.strictPathsWarn && !(0, utils_1.hasPath)(this.data, position)) {
                this.stats.warnings.push(`${kind}: target path '${position}' did not exist; created implicitly`);
            }
            const element = isCopy ? (0, utils_1.cloneJson)(node.data) : node.data;
            const plannedTarget = (0, utils_1.resolveTargetWithPathCreation)(this.data, position);
            if (!isCopy && !(0, ops_1.removeFromOriginal)(node))
                throw new Error('move: source changed before it could be removed');
            // Reuse the pre-resolved target for both move and copy: insertIntoTargetPath
            // inserts INTO the target (never replaces it), so plannedTarget stays valid.
            // Previously copy re-resolved from root per call — a redundant O(depth) traversal.
            (0, ops_1.insertIntoTargetPath)(this.data, position, element, mode, () => plannedTarget, key, this.options, this.stats);
        }
        this.stats[isCopy ? 'copied' : 'moved']++;
        if (this.options.trackOperations !== false)
            this.stats.operations.push(`${kind} -> ${position}`);
    }
    applyActions(node, preparedActions) {
        for (const prepared of preparedActions) {
            if (prepared.plan !== null) {
                (0, actions_1.applyValueAction)(node.data, prepared, this.options, this.stats);
                continue;
            }
            const a = prepared.action;
            switch (a.type) {
                case 'delete_element': {
                    if (!this.options.dryRun)
                        (0, ops_1.removeFromOriginal)(node);
                    this.stats.deletedElements++;
                    if (this.options.trackOperations !== false)
                        this.stats.operations.push(`delete_element at ${node.path?.join('.') ?? '<unknown>'}`);
                    break;
                }
                case 'insert': {
                    const { data, position, key } = a;
                    const insertable = (0, ops_1.canInsertRelative)(node, data, position, key, this.options);
                    if (!insertable) {
                        if (this.options.warnOnOverwrite !== false) {
                            const target = typeof key === 'string' || typeof key === 'number' ? ` '${key}'` : '';
                            this.stats.warnings.push(`insert: target${target} is not writable; operation skipped`);
                        }
                        break;
                    }
                    if (!this.options.dryRun && !(0, ops_1.insertRelative)(node, data, position, key, this.options, this.stats))
                        break;
                    this.stats.inserted++;
                    if (this.options.trackOperations !== false)
                        this.stats.operations.push(`insert ${position} ${typeof key === 'number' ? `index=${key}` : (key ?? '')}`);
                    break;
                }
                case 'move':
                case 'copy': {
                    this.applyMoveOrCopy(node, a, a.type);
                    break;
                }
            }
        }
    }
    applyInsertTo(action) {
        const { position, data, mode, key } = action;
        const validatedTarget = (0, ops_1.assertCanInsertIntoTargetPath)(this.data, position, mode, key);
        if (!(0, ops_1.canInsertIntoResolvedTarget)(validatedTarget, data, mode, key, this.options)) {
            if (this.options.warnOnOverwrite !== false) {
                const target = typeof key === 'string' || typeof key === 'number' ? `${position}.${key}` : position;
                this.stats.warnings.push(`insert_to: target '${target}' write skipped by overwrite policy`);
            }
            return;
        }
        if (this.options.strictPathsWarn && !(0, utils_1.hasPath)(this.data, position)) {
            this.stats.warnings.push(`insert_to: target path '${position}' did not exist; created implicitly`);
        }
        if (!this.options.dryRun) {
            (0, ops_1.insertIntoTargetPath)(this.data, position, data, mode, utils_1.resolveTargetWithPathCreation, key, this.options, this.stats);
        }
        this.stats.inserted++;
        if (this.options.trackOperations !== false)
            this.stats.operations.push(`insert_to ${position} ${mode ?? 'inside'} ${typeof key === 'number' ? `index=${key}` : (key ?? '')}`);
    }
    applyMatchFanout(action, fan, matches) {
        const { targetKey, targetOperator, targetValue, mode, key } = action;
        const targetsAll = (0, ops_1.selectTargets)(this.data, this.options, targetKey, targetOperator, targetValue, (mode ?? 'inside') !== 'inside');
        const targets = fan.allTargets ? targetsAll : (targetsAll.length ? [targetsAll[0]] : []);
        const applied = (0, ops_1.fanoutMatchesToTargets)(fan.kind, matches, targets, mode, key, this.options, this.stats, !!this.options.dryRun);
        if (fan.kind === 'move')
            this.stats.moved += applied;
        else
            this.stats.copied += applied;
        if (this.options.trackOperations !== false)
            this.stats.operations.push(fan.allTargets
                ? `${action.type} -> ${targets.length} targets`
                : `${action.type} -> first target (${targets[0]?.path?.join('.') ?? 'none'})`);
    }
    applyMoveMatchesOverwrite(action, matches) {
        const { targetKey, targetOperator, targetValue, overwriteKey } = action;
        const targets = (0, ops_1.selectTargets)(this.data, this.options, targetKey, targetOperator, targetValue, false);
        const objectTargets = targets.filter((target) => (0, utils_1.isRecordObject)(target.data));
        const ordered = (0, ops_1.orderMatchesForMove)(matches);
        for (const src of ordered) {
            if (!(0, ops_1.canRemoveFromOriginal)(src)) {
                this.stats.warnings.push('move_matches_overwrite: source is not attached to a removable parent; source left in place');
                continue;
            }
            const writableTargets = objectTargets.filter((target) => {
                if ((0, ops_1.wouldCreateMoveCycle)(src.data, target, 'inside'))
                    return false;
                const targetData = target.data;
                const exists = overwriteKey in targetData;
                const effect = (0, ops_1.getAssignmentEffect)(targetData, overwriteKey, this.options, (conflictKey) => new Error(`copy/move overwrite prevented for key '${conflictKey}'`));
                if (effect === 'skip' && this.options.warnOnOverwrite !== false && exists) {
                    this.stats.warnings.push(`overwrite at key '${overwriteKey}'`);
                }
                return effect === 'write';
            });
            if (writableTargets.length === 0) {
                this.stats.warnings.push('move_matches_overwrite: no writable object targets; source left in place');
                continue;
            }
            if (!this.options.dryRun) {
                if (!(0, ops_1.removeFromOriginal)(src))
                    throw new Error('move_matches_overwrite: source changed before it could be removed');
                for (let i = 0; i < writableTargets.length; i++) {
                    const t = writableTargets[i];
                    (0, ops_1.assignWithPolicy)(t.data, overwriteKey, i === 0 ? src.data : (0, utils_1.cloneJson)(src.data), this.options, this.stats, (conflictKey) => new Error(`copy/move overwrite prevented for key '${conflictKey}'`));
                }
            }
            this.stats.moved++;
            if (this.options.trackOperations !== false)
                this.stats.operations.push(`move_matches_overwrite -> ${overwriteKey}`);
        }
    }
    applyGlobalActions(matches) {
        for (const a of this.actions) {
            if (a.type === 'insert_to') {
                this.applyInsertTo(a);
                continue;
            }
            if (!matches || matches.length === 0)
                continue;
            if (a.type === 'move_matches_overwrite') {
                this.applyMoveMatchesOverwrite(a, matches);
                continue;
            }
            const fan = MATCH_FANOUT[a.type];
            if (fan)
                this.applyMatchFanout(a, fan, matches);
        }
    }
}
exports.JsnqPipeline = JsnqPipeline;
exports.default = JsnqPipeline;
//# sourceMappingURL=pipeline.js.map