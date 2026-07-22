import { cloneJsonData, createJsonPathPlan, deleteJsonPath, getJsonBySegments, hasJsonPath, setJsonPlanCacheLimit, writeJsonPath, } from './data-engine.js';
export const isObject = (v) => typeof v === 'object' && v !== null;
export const isRecordObject = (v) => isObject(v) && !Array.isArray(v);
const isNumeric = (s) => /^\d+$/.test(s);
// splitPath shares the engine's bounded plan cache, so path parsing behaves (and
// performs) identically in every host project; returns a fresh, mutable copy.
export const splitPath = (path) => (path ? [...createJsonPathPlan(path).segments] : []);
export const getBySegments = (obj, segments) => getJsonBySegments(obj, segments);
export const setByPath = (obj, path, value) => { writeJsonPath(obj, path, value); };
export const deleteByPath = (obj, path) => { deleteJsonPath(obj, path); };
// Queries are lenient: an unparseable/forbidden path means "not present" (writes still throw).
export const hasPath = (obj, path) => {
    try {
        return hasJsonPath(obj, path);
    }
    catch {
        return false;
    }
};
/**
 * Allocation-light DFS for match collection. Stack state is stored in parallel
 * arrays and result nodes are created only for matches, unlike the generator
 * contract which must allocate a frame for every visited value.
 */
export function scanJsonMatches(data, options, predicate, onMatch) {
    if (!options.buildMeta && !options.returnPaths) {
        const nodes = [data];
        const depths = [0];
        let nodesVisited = 0;
        let observedMaxDepth = 0;
        while (nodes.length > 0) {
            const node = nodes.pop();
            const depth = depths.pop();
            nodesVisited++;
            if (depth > observedMaxDepth)
                observedMaxDepth = depth;
            if (predicate(node) && onMatch({ data: node, depth }) === false) {
                return { nodesVisited, maxDepth: observedMaxDepth, stopped: true };
            }
            if (depth >= options.maxDepth)
                continue;
            const nextDepth = depth + 1;
            if (Array.isArray(node) && options.includeArrays) {
                for (let index = node.length - 1; index >= 0; index--) {
                    nodes.push(node[index]);
                    depths.push(nextDepth);
                }
            }
            else if (isObject(node) && options.includeObjects) {
                const keys = Object.keys(node);
                for (let index = keys.length - 1; index >= 0; index--) {
                    nodes.push(node[keys[index]]);
                    depths.push(nextDepth);
                }
            }
        }
        return { nodesVisited, maxDepth: observedMaxDepth, stopped: false };
    }
    const nodes = [data];
    const depths = [0];
    const parents = [undefined];
    const parentKeys = [undefined];
    const segments = [null];
    const pathBuffer = [];
    let nodesVisited = 0;
    let observedMaxDepth = 0;
    while (nodes.length > 0) {
        const node = nodes.pop();
        const depth = depths.pop();
        const parent = parents.pop();
        const parentKey = parentKeys.pop();
        const segment = segments.pop();
        nodesVisited++;
        if (depth > observedMaxDepth)
            observedMaxDepth = depth;
        if (options.returnPaths) {
            if (segment === null) {
                pathBuffer.length = 0;
            }
            else {
                pathBuffer[depth - 1] = segment;
                pathBuffer.length = depth;
            }
        }
        if (predicate(node)) {
            const result = {
                data: node,
                path: options.returnPaths ? pathBuffer.slice(0, depth) : undefined,
                depth,
                parent: options.buildMeta ? parent : undefined,
                parentKey: options.buildMeta ? parentKey : undefined,
            };
            if (onMatch(result) === false) {
                return { nodesVisited, maxDepth: observedMaxDepth, stopped: true };
            }
        }
        if (depth >= options.maxDepth)
            continue;
        const nextDepth = depth + 1;
        if (Array.isArray(node) && options.includeArrays) {
            for (let index = node.length - 1; index >= 0; index--) {
                nodes.push(node[index]);
                depths.push(nextDepth);
                parents.push(node);
                parentKeys.push(index);
                segments.push(String(index));
            }
        }
        else if (isObject(node) && options.includeObjects) {
            const keys = Object.keys(node);
            for (let index = keys.length - 1; index >= 0; index--) {
                const key = keys[index];
                nodes.push(node[key]);
                depths.push(nextDepth);
                parents.push(node);
                parentKeys.push(key);
                segments.push(key);
            }
        }
    }
    return { nodesVisited, maxDepth: observedMaxDepth, stopped: false };
}
export function* dfsIterator(data, options) {
    const { maxDepth, includeArrays, includeObjects, buildMeta, returnPaths, shouldDescend } = options;
    // Shared path buffer: O(1) index assignment per push instead of O(depth) spread-copy.
    // At yield time, slice(0, depth) produces a fresh array the caller owns — same contract
    // as before, but the per-push allocation ([...(path), segment]) is eliminated.
    // For a 10k-node tree at depth 10 this removes ~100k element copies from the push side.
    const pathBuffer = [];
    const stack = [
        { node: data, segment: null, depth: 0 }
    ];
    while (stack.length) {
        const frame = stack.pop();
        if (frame.depth > maxDepth)
            continue;
        const { node, segment, depth, parent, parentKey } = frame;
        if (returnPaths) {
            if (segment !== null) {
                pathBuffer[depth - 1] = segment;
                pathBuffer.length = depth; // truncate stale deeper segments from prior branches
            }
            else {
                pathBuffer.length = 0; // root
            }
        }
        const path = returnPaths ? pathBuffer.slice(0, depth) : undefined;
        const cur = { data: node, path, depth, parent, parentKey };
        yield cur;
        if (shouldDescend && shouldDescend(cur) === false)
            continue;
        const nextDepth = depth + 1;
        if (Array.isArray(node) && includeArrays) {
            const arr = node;
            for (let i = arr.length - 1; i >= 0; i--) {
                stack.push({
                    node: arr[i],
                    segment: String(i),
                    depth: nextDepth,
                    parent: buildMeta ? node : undefined,
                    parentKey: buildMeta ? i : undefined,
                });
            }
        }
        else if (isObject(node) && includeObjects) {
            const obj = node;
            const keys = Object.keys(obj);
            for (let i = keys.length - 1; i >= 0; i--) {
                const k = keys[i];
                stack.push({
                    node: obj[k],
                    segment: k,
                    depth: nextDepth,
                    parent: buildMeta ? node : undefined,
                    parentKey: buildMeta ? k : undefined,
                });
            }
        }
    }
}
/**
 * Walk `path` from `root` and return the node, its parent and the final key.
 * With `create=true` missing object segments are created ({} or [] when the
 * next segment is numeric) and a missing array index stops the walk (so the
 * parent array + index are returned for relative inserts). With `create=false`
 * nothing is attached: missing segments resolve to a simulated empty node so
 * callers can validate the target shape without mutating the tree.
 */
export function resolveTargetPath(root, path, create) {
    const parts = splitPath(path);
    let parent = null;
    let node = root;
    let key = undefined;
    const len = parts.length;
    for (let i = 0; i < len; i++) {
        const part = parts[i];
        parent = node;
        key = isNumeric(part) ? Number(part) : part;
        if (typeof key === 'number') {
            if (!Array.isArray(parent))
                return { targetNode: undefined, targetParent: parent, targetKey: key };
            const exists = key in parent;
            node = parent[key];
            if (create && !exists)
                break;
            continue;
        }
        if (!isObject(parent))
            return { targetNode: undefined, targetParent: parent, targetKey: key };
        const record = parent;
        if (Object.prototype.hasOwnProperty.call(record, key)) {
            node = record[key];
            continue;
        }
        const next = i + 1 < len && isNumeric(parts[i + 1]) ? [] : {};
        if (create)
            record[key] = next;
        node = next;
    }
    return { targetNode: node, targetParent: parent, targetKey: key };
}
export function resolveTargetWithPathCreation(root, path) {
    return resolveTargetPath(root, path, true);
}
function mergeArrays(aArr, bArr, opts) {
    const a = Array.isArray(aArr) ? aArr : [];
    const b = Array.isArray(bArr) ? bArr : [];
    const strat = opts.arrayStrategy ?? 'replace';
    if (strat === 'replace')
        return bArr !== undefined ? b : a;
    if (strat === 'concat')
        return [...a, ...b];
    // merge-by-key
    const keyer = opts.arrayKey ?? 'id';
    const getKey = (x) => typeof keyer === 'function'
        ? keyer(x)
        : x?.[keyer];
    const isKey = (value) => typeof value === 'string' || (typeof value === 'number' && Number.isFinite(value));
    const countKeys = (items) => {
        const counts = new Map();
        for (const item of items) {
            const key = getKey(item);
            if (isKey(key))
                counts.set(key, (counts.get(key) ?? 0) + 1);
        }
        return counts;
    };
    const aCounts = countKeys(a);
    const bCounts = countKeys(b);
    const out = [...a];
    const uniqueAIndex = new Map();
    for (let i = 0; i < a.length; i++) {
        const key = getKey(a[i]);
        if (isKey(key) && aCounts.get(key) === 1)
            uniqueAIndex.set(key, i);
    }
    for (const item of b) {
        const key = getKey(item);
        // Missing or duplicate keys are ambiguous. Preserve every value instead of
        // collapsing them into a single Map entry and silently dropping data.
        if (!isKey(key) || (aCounts.get(key) ?? 0) > 1 || (bCounts.get(key) ?? 0) > 1) {
            out.push(item);
            continue;
        }
        const existingIndex = uniqueAIndex.get(key);
        if (existingIndex !== undefined) {
            out[existingIndex] = deepMerge(out[existingIndex], item, opts);
        }
        else {
            uniqueAIndex.set(key, out.length);
            out.push(item);
        }
    }
    return out;
}
export function deepMerge(a, b, opts = {}) {
    if (Array.isArray(a) || Array.isArray(b)) {
        return mergeArrays(Array.isArray(a) ? a : undefined, Array.isArray(b) ? b : undefined, opts);
    }
    if (isObject(a) && isObject(b)) {
        const out = { ...a };
        for (const k of Object.keys(b)) {
            const av = a[k];
            const bv = b[k];
            if (isObject(av) && isObject(bv) && !Array.isArray(av) && !Array.isArray(bv)) {
                out[k] = deepMerge(av, bv, opts);
            }
            else if (Array.isArray(av) || Array.isArray(bv)) {
                out[k] = deepMerge(av, bv, opts);
            }
            else {
                out[k] = bv;
            }
        }
        return out;
    }
    return b !== undefined ? b : a;
}
// JSON-like deep clone with structuredClone fallback
export function cloneJson(value) {
    return cloneJsonData(value);
}
export function setPathCacheLimit(limit) {
    // Bounds the engine-wide path plan cache (one cache shared by every host project).
    setJsonPlanCacheLimit(limit);
}
// Build a safe path from segments, quoting when needed and using bracket notation for array indexes
export function buildPath(...segments) {
    const out = [];
    const len = segments.length;
    for (let i = 0; i < len; i++) {
        const seg = segments[i];
        if (typeof seg === 'number' || (isNumeric(String(seg)) && out.length > 0)) {
            out.push(`[${Number(seg)}]`);
            continue;
        }
        const s = String(seg);
        const needsQuote = /[\[\]\.\s]/.test(s);
        if (i === 0 && !needsQuote && s.length > 0 && !isNumeric(s)) {
            out.push(s);
        }
        else if (needsQuote || s.length === 0 || isNumeric(s)) {
            const escaped = s.replace(/["\\]/g, r => `\\${r}`);
            out.push(`["${escaped}"]`);
        }
        else {
            out.push(`.${s}`);
        }
    }
    return out.join('');
}
export function parseDeepSearchPath(path) {
    if (!path) {
        return { isDeep: false, searchSegments: [] };
    }
    // Sprawdź czy path zawiera @
    const atIndex = path.indexOf('@');
    if (atIndex === -1) {
        // Brak @ - zwykła ścieżka
        return { isDeep: false, searchSegments: splitPath(path) };
    }
    if (atIndex === 0) {
        // @ na początku (np. "@id") - deep search w bieżącej tablicy
        const searchPath = path.substring(1);
        return {
            isDeep: true,
            arrayKey: undefined, // Bieżąca tablica
            searchSegments: splitPath(searchPath)
        };
    }
    // @ w środku (np. "fields@id") - deep search w określonej tablicy
    const arrayKey = path.substring(0, atIndex);
    const searchPath = path.substring(atIndex + 1);
    return {
        isDeep: true,
        arrayKey,
        searchSegments: splitPath(searchPath)
    };
}
// Deep array matching - rekurencyjne przeszukiwanie tablicy
export function deepArrayMatch(node, arrayKey, searchSegments, opFn, value, maxDepth = Number.POSITIVE_INFINITY) {
    for (const _ of deepArrayIterator(node, arrayKey, searchSegments, opFn, value, [], 0, maxDepth)) {
        return true;
    }
    ;
    return false;
}
// Deep array iterator - yield all matching elements from nested arrays
export function* deepArrayIterator(node, arrayKey, searchSegments, opFn, value, path = [], depth = 0, maxDepth = Number.POSITIVE_INFINITY) {
    if (!arrayKey) {
        // @id - yield node itself if matches
        const nodeValue = getBySegments(node, searchSegments);
        if (opFn(nodeValue, value)) {
            yield { data: node, path, depth };
        }
        return;
    }
    const arrayKeySegments = splitPath(arrayKey);
    // fields@id - iterate through array and nested arrays
    const targetArray = getBySegments(node, arrayKeySegments);
    if (!Array.isArray(targetArray)) {
        return;
    }
    const stack = [{
            arr: targetArray,
            currentPath: [...path, ...arrayKeySegments],
            currentDepth: depth,
            parent: node,
            nextIndex: 0,
            ancestorArrays: [targetArray],
        }];
    while (stack.length) {
        const frame = stack[stack.length - 1];
        if (frame.nextIndex >= frame.arr.length) {
            stack.pop();
            continue;
        }
        const i = frame.nextIndex++;
        const item = frame.arr[i];
        const itemPath = [...frame.currentPath, String(i)];
        const itemValue = getBySegments(item, searchSegments);
        if (opFn(itemValue, value)) {
            yield { data: item, path: itemPath, depth: frame.currentDepth, parent: frame.arr, parentKey: i };
        }
        if (frame.currentDepth >= maxDepth || !isObject(item)) {
            continue;
        }
        const nestedArray = getBySegments(item, arrayKeySegments);
        if (!Array.isArray(nestedArray) || frame.ancestorArrays.includes(nestedArray)) {
            continue;
        }
        stack.push({
            arr: nestedArray,
            currentPath: [...itemPath, ...arrayKeySegments],
            currentDepth: frame.currentDepth + 1,
            parent: item,
            nextIndex: 0,
            ancestorArrays: [...frame.ancestorArrays, nestedArray],
        });
    }
}
//# sourceMappingURL=utils.js.map