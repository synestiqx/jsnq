import type { CompiledCriterion } from './types';
import { isOperatorKnown } from './operators-registry';

/**
 * Optional codegen fast path for the criteria matcher. Compiles a set of single-segment,
 * non-deep, built-in-operator criteria into ONE predicate via `new Function` (cached by
 * signature), so the JIT inlines the comparisons like a hand-written `.filter` instead of
 * paying per-item operator indirection + the criteria loop.
 *
 * SAFETY: returns null (caller keeps the interpreter `criteriaMatch`) whenever anything is
 * not trivially codegen-able — deep `@`, multi-segment paths, regex / custom operators, an
 * empty segment, or environments where `new Function` is blocked (strict CSP). The generated
 * code mirrors criterionMatches + operators-registry EXACTLY; the fastpath-parity / edge /
 * vs-native suites guard that equivalence.
 */

export type CompiledPredicate = (data: unknown) => boolean;

let canCompile: boolean | null = null;
function compilationAvailable(): boolean {
  if (canCompile !== null) return canCompile;
  try { new Function('return true'); canCompile = true; } catch { canCompile = false; }
  return canCompile;
}

type Factory = (vals: unknown[]) => CompiledPredicate;
const factoryCache = new Map<string, Factory | null>();
let cacheMax = 2000;
export function setCompiledPredicateCacheLimit(limit: number): void { cacheMax = Math.max(0, limit | 0); }
export function clearCompiledPredicateCache(): void { factoryCache.clear(); }

// Boolean expression for an operator with value-var `a` and criterion-value ref `b`,
// byte-for-byte equivalent to operators-registry.ts. Returns null for non-codegen ops.
export function opExpr(op: string, a: string, b: string): string | null {
  switch (op) {
    case '==': return `${a} == ${b}`;
    case '===': return `${a} === ${b}`;
    case '!=': return `${a} != ${b}`;
    case '!==': return `${a} !== ${b}`;
    case '<': return `${a} < ${b}`;
    case '<=': return `${a} <= ${b}`;
    case '>': return `${a} > ${b}`;
    case '>=': return `${a} >= ${b}`;
    case 'includes': return `(typeof ${a}==='string' ? ${a}.includes(String(${b})) : Array.isArray(${a}) ? ${a}.includes(${b}) : false)`;
    case '!includes': return `(typeof ${a}==='string' ? !${a}.includes(String(${b})) : Array.isArray(${a}) ? !${a}.includes(${b}) : true)`;
    case 'startsWith': return `(typeof ${a}==='string' && typeof ${b}==='string' ? ${a}.startsWith(${b}) : false)`;
    case 'endsWith': return `(typeof ${a}==='string' && typeof ${b}==='string' ? ${a}.endsWith(${b}) : false)`;
    case 'isArray': return `(typeof ${b}==='boolean' ? Array.isArray(${a})===${b} : Array.isArray(${a}))`;
    case 'isObject': return `(typeof ${b}==='boolean' ? (typeof ${a}==='object'&&${a}!==null&&!Array.isArray(${a}))===${b} : (typeof ${a}==='object'&&${a}!==null&&!Array.isArray(${a})))`;
    default: return null;
  }
}

function isCodegenable(criteria: ReadonlyArray<CompiledCriterion>): boolean {
  if (criteria.length === 0) return false;
  for (const c of criteria) {
    if (c.isDeep) return false;
    if (c.segments.length !== 1) return false;
    if (c.segments[0] === undefined) return false;
    if (!isOperatorKnown(String(c.operator))) return false;
    if (opExpr(String(c.operator), 'a', 'b') === null) return false;
  }
  return true;
}

function buildFactory(criteria: ReadonlyArray<CompiledCriterion>): Factory | null {
  const lines: string[] = [
    `if (it === null || typeof it !== 'object') return false;`,
    `var arr = Array.isArray(it);`,
  ];
  for (let i = 0; i < criteria.length; i++) {
    const key = JSON.stringify(criteria[i].segments[0]); // exact key string, escaped
    const a = `a${i}`;
    const op = opExpr(String(criteria[i].operator), a, `vals[${i}]`)!;
    // Mirrors criterionMatches: array → numeric index in range (NaN/out-of-range = no match);
    // object → own/inherited key must be present (`in`); primitive already returned false above.
    lines.push(`var ${a};`);
    lines.push(`if (arr) { if (${key} === 'length') { ${a} = it.length; } else { var i${i} = +${key}; if (!(i${i} >= 0 && i${i} < it.length)) return false; ${a} = it[i${i}]; } } else { if (!(${key} in it)) return false; ${a} = it[${key}]; }`);
    lines.push(`if (!(${op})) return false;`);
  }
  lines.push(`return true;`);
  try {
    return new Function('vals', `return function(it){\n${lines.join('\n')}\n};`) as Factory;
  } catch {
    return null;
  }
}

/**
 * Returns a compiled predicate for `criteria`, or null when the interpreter must be used.
 * Cheap to call per query: the generated factory is cached by (segment,operator) signature
 * and bound to the current criterion values on each call.
 */
export function compileCriteriaPredicate(criteria: ReadonlyArray<CompiledCriterion>): CompiledPredicate | null {
  if (!compilationAvailable() || !isCodegenable(criteria)) return null;
  const sig = criteria.map((c) => `${c.segments[0]}${c.operator}`).join('');
  let factory = factoryCache.get(sig);
  if (factory === undefined) {
    factory = buildFactory(criteria);
    if (factoryCache.size >= cacheMax) factoryCache.clear();
    factoryCache.set(sig, factory);
  }
  if (!factory) return null;
  const vals = criteria.map((c) => c.value);
  return factory(vals);
}
