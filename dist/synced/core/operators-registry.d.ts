import type { ComparisonOperator } from './types.js';
/** Function signature for registered comparison operators. */
type OperatorFn = (a: unknown, b: unknown) => boolean;
export declare function registerOperator(name: string, fn: OperatorFn): void;
export declare const getOperatorFn: (op: ComparisonOperator) => OperatorFn;
export declare function isOperatorKnown(op: string): boolean;
export {};
//# sourceMappingURL=operators-registry.d.ts.map