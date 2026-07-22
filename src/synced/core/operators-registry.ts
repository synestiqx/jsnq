import type { ComparisonOperator } from './types';

/** Function signature for registered comparison operators. */
type OperatorFn = (a: unknown, b: unknown) => boolean;

interface OperatorDefinition {
  execute: OperatorFn;
}

// Built-in operator registry local to jsnq core
const Operators: Partial<Record<ComparisonOperator, OperatorDefinition>> & Record<string, OperatorDefinition> = {
  '==': { execute: (a, b) => a == b },
  '===': { execute: (a, b) => a === b },
  '!=': { execute: (a, b) => a != b },
  '!==': { execute: (a, b) => a !== b },
  '<': { execute: (a, b) => (a as number) < (b as number) },
  '<=': { execute: (a, b) => (a as number) <= (b as number) },
  '>': { execute: (a, b) => (a as number) > (b as number) },
  '>=': { execute: (a, b) => (a as number) >= (b as number) },
  includes: { execute: (a, b) => (typeof a === 'string' ? a.includes(String(b)) : Array.isArray(a) ? (a as unknown[]).includes(b) : false) },
  '!includes': { execute: (a, b) => (typeof a === 'string' ? !a.includes(String(b)) : Array.isArray(a) ? !(a as unknown[]).includes(b) : true) },
  startsWith: { execute: (a, b) => (typeof a === 'string' && typeof b === 'string' ? a.startsWith(b) : false) },
  endsWith: { execute: (a, b) => (typeof a === 'string' && typeof b === 'string' ? a.endsWith(b) : false) },
  regex: {
    execute: (a, b) => {
      if (typeof a !== 'string') return false;
      try {
        if (b instanceof RegExp) return b.test(a);
        const raw = String(b);
        // Support '/pattern/flags' or plain 'pattern'
        if (raw.startsWith('/') && raw.lastIndexOf('/') > 0) {
          const last = raw.lastIndexOf('/');
          const pattern = raw.slice(1, last);
          const flags = raw.slice(last + 1);
          return new RegExp(pattern, flags as string).test(a);
        }
        return new RegExp(raw).test(a);
      } catch {
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

export function registerOperator(name: string, fn: OperatorFn): void {
  Operators[name] = { execute: fn };
}

const fallbackFn: OperatorFn = () => false;
export const getOperatorFn = (op: ComparisonOperator): OperatorFn => {
  return Operators[op]?.execute ?? fallbackFn;
};

export function isOperatorKnown(op: string): boolean {
  return typeof Operators[op]?.execute === 'function';
}
