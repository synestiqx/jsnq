import type { CompiledCriterion } from './types.js';
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
export declare function setCompiledPredicateCacheLimit(limit: number): void;
export declare function clearCompiledPredicateCache(): void;
export declare function opExpr(op: string, a: string, b: string): string | null;
/**
 * Returns a compiled predicate for `criteria`, or null when the interpreter must be used.
 * Cheap to call per query: the generated factory is cached by (segment,operator) signature
 * and bound to the current criterion values on each call.
 */
export declare function compileCriteriaPredicate(criteria: ReadonlyArray<CompiledCriterion>): CompiledPredicate | null;
//# sourceMappingURL=compiled-predicate.d.ts.map