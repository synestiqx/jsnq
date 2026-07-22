"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOperatorFn = void 0;
exports.registerOperator = registerOperator;
exports.isOperatorKnown = isOperatorKnown;
// Built-in operator registry local to jsnq core
const Operators = {
    '==': { execute: (a, b) => a == b },
    '===': { execute: (a, b) => a === b },
    '!=': { execute: (a, b) => a != b },
    '!==': { execute: (a, b) => a !== b },
    '<': { execute: (a, b) => a < b },
    '<=': { execute: (a, b) => a <= b },
    '>': { execute: (a, b) => a > b },
    '>=': { execute: (a, b) => a >= b },
    includes: { execute: (a, b) => (typeof a === 'string' ? a.includes(String(b)) : Array.isArray(a) ? a.includes(b) : false) },
    '!includes': { execute: (a, b) => (typeof a === 'string' ? !a.includes(String(b)) : Array.isArray(a) ? !a.includes(b) : true) },
    startsWith: { execute: (a, b) => (typeof a === 'string' && typeof b === 'string' ? a.startsWith(b) : false) },
    endsWith: { execute: (a, b) => (typeof a === 'string' && typeof b === 'string' ? a.endsWith(b) : false) },
    regex: {
        execute: (a, b) => {
            if (typeof a !== 'string')
                return false;
            try {
                if (b instanceof RegExp)
                    return b.test(a);
                const raw = String(b);
                // Support '/pattern/flags' or plain 'pattern'
                if (raw.startsWith('/') && raw.lastIndexOf('/') > 0) {
                    const last = raw.lastIndexOf('/');
                    const pattern = raw.slice(1, last);
                    const flags = raw.slice(last + 1);
                    return new RegExp(pattern, flags).test(a);
                }
                return new RegExp(raw).test(a);
            }
            catch {
                return false;
            }
        }
    },
    // Type helpers
    isArray: { execute: (a, b) => {
            const res = Array.isArray(a);
            return typeof b === 'boolean' ? res === b : res;
        } },
    isObject: { execute: (a, b) => {
            const res = typeof a === 'object' && a !== null && !Array.isArray(a);
            return typeof b === 'boolean' ? res === b : res;
        } },
};
function registerOperator(name, fn) {
    Operators[name] = { execute: fn };
}
const fallbackFn = () => false;
const getOperatorFn = (op) => {
    return Operators[op]?.execute ?? fallbackFn;
};
exports.getOperatorFn = getOperatorFn;
function isOperatorKnown(op) {
    return typeof Operators[op]?.execute === 'function';
}
//# sourceMappingURL=operators-registry.js.map