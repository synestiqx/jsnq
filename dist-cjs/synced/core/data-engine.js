"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JsonDataCursor = void 0;
exports.setJsonPlanCacheLimit = setJsonPlanCacheLimit;
exports.getJsonPlanCacheStats = getJsonPlanCacheStats;
exports.clearJsonPlanCache = clearJsonPlanCache;
exports.splitJsonPath = splitJsonPath;
exports.createJsonPathPlan = createJsonPathPlan;
exports.createJsonPathPlanFromSegments = createJsonPathPlanFromSegments;
exports.getJsonParentSegments = getJsonParentSegments;
exports.getJsonAffectedPaths = getJsonAffectedPaths;
exports.createMutationResult = createMutationResult;
exports.readJsonPath = readJsonPath;
exports.getJsonBySegments = getJsonBySegments;
exports.hasJsonPath = hasJsonPath;
exports.resolveJsonParentAndKey = resolveJsonParentAndKey;
exports.writeJsonPath = writeJsonPath;
exports.writeJsonPathValue = writeJsonPathValue;
exports.deleteJsonPath = deleteJsonPath;
exports.cloneJsonData = cloneJsonData;
const FORBIDDEN_SEGMENTS = new Set(['__proto__', 'prototype', 'constructor']);
let planCacheMax = 5000;
const planCache = new Map();
const planCacheMetrics = { hits: 0, misses: 0, writes: 0, evictions: 0 };
function cachePlan(path, plan) {
    planCache.set(path, plan);
    planCacheMetrics.writes++;
    if (planCache.size > planCacheMax) {
        const first = planCache.keys().next().value;
        if (first !== undefined) {
            planCache.delete(first);
            planCacheMetrics.evictions++;
        }
    }
    return plan;
}
/** Bound the compiled path-plan cache (FIFO eviction); floor of 16 entries. */
function setJsonPlanCacheLimit(limit) {
    planCacheMax = Math.max(16, Math.floor(limit));
    while (planCache.size > planCacheMax) {
        const first = planCache.keys().next().value;
        if (first === undefined)
            break;
        planCache.delete(first);
        planCacheMetrics.evictions++;
    }
}
function getJsonPlanCacheStats() {
    const { hits, misses, writes, evictions } = planCacheMetrics;
    const total = hits + misses;
    return {
        size: planCache.size,
        limit: planCacheMax,
        hits,
        misses,
        writes,
        evictions,
        hitRate: total > 0 ? hits / total : 0,
    };
}
function clearJsonPlanCache() {
    planCache.clear();
    planCacheMetrics.hits = 0;
    planCacheMetrics.misses = 0;
    planCacheMetrics.writes = 0;
    planCacheMetrics.evictions = 0;
}
function isObjectLike(value) {
    return value !== null && (typeof value === 'object' || typeof value === 'function');
}
function isNumericSegment(segment) {
    if (!segment)
        return false;
    for (let i = 0; i < segment.length; i++) {
        const code = segment.charCodeAt(i);
        if (code < 48 || code > 57)
            return false;
    }
    return true;
}
function splitJsonPath(path) {
    if (!path)
        return [];
    const out = [];
    let token = '';
    let index = 0;
    const push = () => {
        if (token.length > 0) {
            out.push(token);
            token = '';
        }
    };
    while (index < path.length) {
        const char = path[index];
        if (char === '\\') {
            if (index + 1 < path.length) {
                token += path[index + 1];
                index += 2;
                continue;
            }
            index++;
            continue;
        }
        if (char === '.') {
            push();
            index++;
            continue;
        }
        if (char === '[') {
            push();
            index++;
            if (index >= path.length)
                break;
            if (path[index] === '"' || path[index] === "'") {
                const quote = path[index++];
                let quoted = '';
                while (index < path.length) {
                    const q = path[index];
                    if (q === '\\' && index + 1 < path.length) {
                        quoted += path[index + 1];
                        index += 2;
                        continue;
                    }
                    if (q === quote) {
                        index++;
                        break;
                    }
                    quoted += q;
                    index++;
                }
                if (path[index] === ']')
                    index++;
                out.push(quoted);
                continue;
            }
            let bracket = '';
            while (index < path.length && path[index] !== ']')
                bracket += path[index++];
            if (path[index] === ']')
                index++;
            if (bracket.length > 0)
                out.push(bracket);
            continue;
        }
        token += char;
        index++;
    }
    push();
    assertSafeSegments(out, path);
    return out;
}
function assertSafeSegments(segments, path) {
    for (const segment of segments) {
        if (FORBIDDEN_SEGMENTS.has(segment))
            throw new Error(`Unsafe path segment in '${path}'`);
    }
}
function createJsonPathPlan(path) {
    const normalized = path ?? '';
    const cached = planCache.get(normalized);
    if (cached) {
        planCacheMetrics.hits++;
        return cached;
    }
    planCacheMetrics.misses++;
    const segments = normalized ? splitJsonPath(normalized) : [];
    assertSafeSegments(segments, normalized);
    const parentSegments = segments.slice(0, -1);
    return cachePlan(normalized, {
        path: normalized,
        segments,
        parentSegments,
        key: segments.length > 0 ? segments[segments.length - 1] : null,
        nextIsIndex: parentSegments.map((_, index) => isNumericSegment(segments[index + 1])),
    });
}
function createJsonPathPlanFromSegments(segments) {
    const safeSegments = Array.from(segments, String);
    const path = safeSegments.join('.');
    assertSafeSegments(safeSegments, path);
    const parentSegments = safeSegments.slice(0, -1);
    return {
        path,
        segments: safeSegments,
        parentSegments,
        key: safeSegments.length > 0 ? safeSegments[safeSegments.length - 1] : null,
        nextIsIndex: parentSegments.map((_, index) => isNumericSegment(safeSegments[index + 1])),
    };
}
function getJsonParentSegments(pathOrPlan) {
    const plan = typeof pathOrPlan === 'string' ? createJsonPathPlan(pathOrPlan) : pathOrPlan;
    return plan.parentSegments;
}
function getJsonAffectedPaths(pathOrPlan, mode = 'exact') {
    const plan = typeof pathOrPlan === 'string' ? createJsonPathPlan(pathOrPlan) : pathOrPlan;
    if (plan.segments.length === 0)
        return [''];
    if (mode === 'exact')
        return [plan.path];
    const paths = [];
    for (let i = 1; i <= plan.segments.length; i++)
        paths.push(plan.segments.slice(0, i).join('.'));
    return paths;
}
const EMPTY_JSON_PATHS = Object.freeze([]);
function uniqueJsonPaths(paths) {
    if (paths.length === 0)
        return EMPTY_JSON_PATHS;
    if (paths.length === 1)
        return paths[0] == null ? EMPTY_JSON_PATHS : paths;
    const out = [];
    const seen = new Set();
    for (const path of paths) {
        if (path == null)
            continue;
        if (!seen.has(path)) {
            seen.add(path);
            out.push(path);
        }
    }
    return out;
}
function getJsonParentAffectedPaths(plan) {
    if (plan.segments.length === 0)
        return EMPTY_JSON_PATHS;
    return getJsonAffectedPaths(plan, 'branch').slice(0, -1);
}
/**
 * Mutation result with a stable hidden class. `parents` is computed lazily via a
 * shared prototype getter: per-instance Object.defineProperty accessors made every
 * exact-path write allocate closures and de-optimize V8 inline caches, which
 * dominated browser write profiles (createMutationResult + GC > 55% self time).
 */
class JsonMutationResultImpl {
    path;
    kind;
    previous;
    next;
    existed;
    changed;
    inserted;
    deleted;
    descendants;
    branchReplaced;
    affectedPaths;
    _plan;
    _parents;
    constructor(plan, kind, previous, next, existed, changed, inserted, deleted, descendants, branchReplaced, affectedPaths, parents) {
        this.path = plan.path;
        this.kind = kind;
        this.previous = previous;
        this.next = next;
        this.existed = existed;
        this.changed = changed;
        this.inserted = inserted;
        this.deleted = deleted;
        this.descendants = descendants;
        this.branchReplaced = branchReplaced;
        this.affectedPaths = affectedPaths;
        this._plan = plan;
        this._parents = parents;
    }
    get parents() {
        const cached = this._parents;
        if (cached !== null)
            return cached;
        const parents = getJsonParentAffectedPaths(this._plan);
        this._parents = parents;
        return parents;
    }
    set parents(value) {
        this._parents = value;
    }
}
/** Allocation-light result for the exact single-path set hot path (proxy writes). */
function createExactSetResult(plan, previous, next, existed, branchReplaced) {
    const changed = [plan.path];
    return new JsonMutationResultImpl(plan, 'set', previous, next, existed, changed, existed ? EMPTY_JSON_PATHS : changed, EMPTY_JSON_PATHS, EMPTY_JSON_PATHS, branchReplaced, changed, null);
}
function createMutationResult(init) {
    const plan = typeof init.path === 'string' ? createJsonPathPlan(init.path) : init.path;
    const changed = uniqueJsonPaths(init.changed ?? EMPTY_JSON_PATHS);
    const inserted = uniqueJsonPaths(init.inserted ?? EMPTY_JSON_PATHS);
    const deleted = uniqueJsonPaths(init.deleted ?? EMPTY_JSON_PATHS);
    const descendants = uniqueJsonPaths(init.descendants ?? EMPTY_JSON_PATHS);
    const affectedPaths = uniqueJsonPaths(init.affectedPaths ?? [
        ...(init.parents ?? getJsonParentAffectedPaths(plan)),
        ...changed,
        ...inserted,
        ...deleted,
        ...descendants,
    ]);
    return new JsonMutationResultImpl(plan, init.kind, init.previous, init.next, init.existed ?? false, changed, inserted, deleted, descendants, init.branchReplaced ?? false, affectedPaths, init.parents ? uniqueJsonPaths(init.parents) : null);
}
function readJsonPath(root, pathOrPlan) {
    const plan = typeof pathOrPlan === 'string' ? createJsonPathPlan(pathOrPlan) : pathOrPlan;
    return plan.segments.length === 0 ? root : getJsonBySegments(root, plan.segments);
}
function getJsonBySegments(obj, segments) {
    // Indexed loop (not for...of) — avoids per-call iterator allocation on this hot path
    // (~10-15% on the dominant object/nested segment walk). Array string-index stays as-is:
    // a numeric-conversion variant was measured slower for objects (megamorphic key access).
    let current = obj;
    const len = segments.length;
    for (let i = 0; i < len; i++) {
        if (current == null)
            return undefined;
        current = current[segments[i]];
    }
    return current;
}
function hasJsonPath(root, pathOrPlan) {
    const plan = typeof pathOrPlan === 'string' ? createJsonPathPlan(pathOrPlan) : pathOrPlan;
    let current = root;
    for (const segment of plan.segments) {
        if (current == null)
            return false;
        if (Array.isArray(current) && isNumericSegment(segment)) {
            const index = Number(segment);
            if (index < 0 || index >= current.length)
                return false;
            current = current[index];
            continue;
        }
        if (!Object.prototype.hasOwnProperty.call(current, segment))
            return false;
        current = current[segment];
    }
    return true;
}
function resolveJsonParentAndKey(root, pathOrPlan, options = {}) {
    const plan = typeof pathOrPlan === 'string' ? createJsonPathPlan(pathOrPlan) : pathOrPlan;
    if (plan.segments.length === 0)
        return { parent: root, key: null, segments: plan.segments };
    let parent = root;
    for (let i = 0; i < plan.parentSegments.length; i++) {
        const segment = plan.parentSegments[i];
        if (!isObjectLike(parent))
            return { parent: undefined, key: plan.key, segments: plan.segments };
        const current = parent[segment];
        if (current == null || !isObjectLike(current)) {
            if (!options.create)
                return { parent: undefined, key: plan.key, segments: plan.segments };
            parent[segment] = plan.nextIsIndex[i] ? [] : {};
        }
        else if (plan.nextIsIndex[i] && !Array.isArray(current)) {
            if (!options.create)
                return { parent: undefined, key: plan.key, segments: plan.segments };
            parent[segment] = [];
        }
        parent = parent[segment];
    }
    return { parent, key: plan.key, segments: plan.segments };
}
function writeJsonPath(root, pathOrPlan, value) {
    const plan = typeof pathOrPlan === 'string' ? createJsonPathPlan(pathOrPlan) : pathOrPlan;
    if (plan.key == null) {
        return createExactSetResult(plan, root, value, true, isObjectLike(root) || isObjectLike(value));
    }
    const { parent, key } = resolveJsonParentAndKey(root, plan, { create: true });
    if (!isObjectLike(parent) || key == null) {
        return createMutationResult({ path: plan, kind: 'set', next: value, parents: [], affectedPaths: [] });
    }
    const existed = Object.prototype.hasOwnProperty.call(parent, key);
    const previous = parent[key];
    assignJsonValue(parent, key, value);
    return createExactSetResult(plan, previous, value, existed, isObjectLike(previous) || isObjectLike(value));
}
function assignJsonValue(parent, key, value) {
    if (Array.isArray(parent) && isNumericSegment(key))
        parent[Number(key)] = value;
    else
        parent[key] = value;
}
/**
 * Write-only variant for hosts that perform their own wake bookkeeping. It uses
 * the same cached path plan and parent resolver as `writeJsonPath`, but avoids
 * allocating a mutation-result object and path arrays that the caller would discard.
 * Returns false for a root path or an unresolvable target.
 */
function writeJsonPathValue(root, pathOrPlan, value) {
    const plan = typeof pathOrPlan === 'string' ? createJsonPathPlan(pathOrPlan) : pathOrPlan;
    if (plan.key == null)
        return false;
    const { parent, key } = resolveJsonParentAndKey(root, plan, { create: true });
    if (!isObjectLike(parent) || key == null)
        return false;
    assignJsonValue(parent, key, value);
    return true;
}
function deleteJsonPath(root, pathOrPlan) {
    const plan = typeof pathOrPlan === 'string' ? createJsonPathPlan(pathOrPlan) : pathOrPlan;
    if (plan.key == null) {
        const exact = getJsonAffectedPaths(plan, 'exact');
        return createMutationResult({
            path: plan,
            kind: 'delete',
            previous: root,
            existed: true,
            deleted: exact,
            branchReplaced: isObjectLike(root),
            affectedPaths: exact,
        });
    }
    const { parent, key } = resolveJsonParentAndKey(root, plan);
    if (!isObjectLike(parent) || key == null) {
        return createMutationResult({ path: plan, kind: 'delete', parents: [], affectedPaths: [] });
    }
    const existed = Object.prototype.hasOwnProperty.call(parent, key);
    const previous = parent[key];
    if (Array.isArray(parent) && isNumericSegment(key)) {
        const index = Number(key);
        if (index >= 0 && index < parent.length)
            parent.splice(index, 1);
    }
    else {
        delete parent[key];
    }
    return createMutationResult({
        path: plan,
        kind: 'delete',
        previous,
        existed,
        deleted: existed ? getJsonAffectedPaths(plan, 'exact') : [],
        branchReplaced: existed && isObjectLike(previous),
        affectedPaths: getJsonAffectedPaths(plan, 'branch'),
    });
}
class JsonDataCursor {
    cursorNode = null;
    cursorPathSegments = null;
    prefetch(path, node) {
        const plan = createJsonPathPlan(path);
        this.cursorNode = node ?? null;
        this.cursorPathSegments = plan.segments.length > 0 ? [...plan.segments] : null;
    }
    writeWithPlan(root, plan, value) {
        if (plan.key == null) {
            return createExactSetResult(plan, root, value, true, isObjectLike(root) || isObjectLike(value));
        }
        let current = root;
        let startIndex = 0;
        if (this.cursorNode && this.cursorPathSegments) {
            const cached = this.cursorPathSegments;
            let isPrefix = cached.length <= plan.parentSegments.length;
            for (let i = 0; isPrefix && i < cached.length; i++) {
                if (cached[i] !== plan.parentSegments[i])
                    isPrefix = false;
            }
            if (isPrefix) {
                current = this.cursorNode;
                startIndex = cached.length;
            }
        }
        try {
            for (let i = startIndex; i < plan.parentSegments.length; i++) {
                const segment = plan.parentSegments[i];
                const nextIsIndex = plan.nextIsIndex[i];
                const existing = current[segment];
                if (existing == null || !isObjectLike(existing))
                    current[segment] = nextIsIndex ? [] : {};
                else if (nextIsIndex && !Array.isArray(existing))
                    current[segment] = [];
                current = current[segment];
            }
            const previous = current[plan.key];
            const existed = Object.prototype.hasOwnProperty.call(current, plan.key);
            if (Array.isArray(current) && isNumericSegment(plan.key))
                current[Number(plan.key)] = value;
            else
                current[plan.key] = value;
            this.cursorNode = current;
            this.cursorPathSegments = plan.parentSegments;
            return createExactSetResult(plan, previous, value, existed, isObjectLike(previous) || isObjectLike(value));
        }
        catch {
            const result = writeJsonPath(root, plan, value);
            const lastParentSegment = plan.parentSegments.length ? plan.parentSegments[plan.parentSegments.length - 1] : null;
            const parent = lastParentSegment == null ? root : readJsonPath(root, { ...plan, segments: plan.parentSegments, parentSegments: plan.parentSegments.slice(0, -1), key: lastParentSegment, nextIsIndex: [] });
            this.cursorNode = isObjectLike(parent) ? parent : null;
            this.cursorPathSegments = plan.parentSegments.slice();
            return result;
        }
    }
    invalidateForDeletion(path) {
        if (!this.cursorPathSegments)
            return;
        const currentPath = this.cursorPathSegments.join('.');
        if (currentPath === path || currentPath.startsWith(`${path}.`) || path.startsWith(`${currentPath}.`)) {
            this.clear();
        }
    }
    clear() {
        this.cursorNode = null;
        this.cursorPathSegments = null;
    }
    get active() {
        return this.cursorNode !== null;
    }
}
exports.JsonDataCursor = JsonDataCursor;
function cloneJsonValue(value, seen) {
    if (value === null || typeof value !== 'object') {
        if ((typeof value === 'function' || typeof value === 'symbol') && typeof structuredClone === 'function') {
            return structuredClone(value);
        }
        return value;
    }
    const cached = seen.get(value);
    if (cached !== undefined)
        return cached;
    if (Array.isArray(value)) {
        const clone = new Array(value.length);
        seen.set(value, clone);
        for (let index = 0; index < value.length; index++) {
            if (index in value)
                clone[index] = cloneJsonValue(value[index], seen);
        }
        return clone;
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
        if (typeof structuredClone === 'function') {
            const clone = structuredClone(value);
            seen.set(value, clone);
            return clone;
        }
        return JSON.parse(JSON.stringify(value));
    }
    const clone = Object.create(prototype);
    seen.set(value, clone);
    const source = value;
    const keys = Object.keys(source);
    for (let index = 0; index < keys.length; index++) {
        const key = keys[index];
        const child = cloneJsonValue(source[key], seen);
        if (key === '__proto__') {
            Object.defineProperty(clone, key, { value: child, enumerable: true, configurable: true, writable: true });
        }
        else {
            clone[key] = child;
        }
    }
    return clone;
}
/**
 * Clone the JSON-like state shape without paying structuredClone's serializer
 * overhead for ordinary arrays and records. Non-plain host objects retain the
 * previous structuredClone behavior; the WeakMap also preserves shared refs
 * and cycles for plain data supplied through untyped JavaScript callers.
 */
function cloneJsonData(value) {
    if (value === null || typeof value !== 'object')
        return value;
    return cloneJsonValue(value, new WeakMap());
}
//# sourceMappingURL=data-engine.js.map