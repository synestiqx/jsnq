import type { CompiledCriterion, ComparisonOperator, SearchOptions } from './types.js';
/**
 * Criteria compilation + matching, shared by the DFS pipeline, the flat-array
 * fast path and the sequential deep (`@`) matcher. Standalone: depends only on
 * the operator registry and pure tree utils, so it is independently testable.
 */
export interface StrictOperatorContext {
    warnedUnknownOps: Set<string>;
    warnings: string[];
}
export declare function compileCriterion(key: string, operator: ComparisonOperator, value: unknown): CompiledCriterion;
/** Apply the `operatorsStrict` policy for a possibly-unknown operator. */
export declare function enforceKnownOperator(criterion: CompiledCriterion, options: Readonly<SearchOptions>, ctx: StrictOperatorContext): void;
/**
 * Standard (non-deep) criterion check against a node value: the first segment
 * must be present on the node (array index in range / own object key), then the
 * extracted value is compared via the registered operator.
 */
export declare function criterionMatches(criterion: CompiledCriterion, data: unknown): boolean;
/**
 * Full criteria conjunction (deep `@` criteria included) with strict-operator
 * policy applied per criterion, in order, stopping at the first failure.
 */
export declare function criteriaMatch(criteria: ReadonlyArray<CompiledCriterion>, data: unknown, options: Readonly<SearchOptions>, ctx: StrictOperatorContext): boolean;
//# sourceMappingURL=match.d.ts.map