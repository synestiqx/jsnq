import type { CompiledCriterion, ComparisonOperator, SearchOptions } from './types';
import { getOperatorFn, isOperatorKnown } from './operators-registry';
import { deepArrayMatch, getBySegments, isObject, parseDeepSearchPath, splitPath } from './utils';

/**
 * Criteria compilation + matching, shared by the DFS pipeline, the flat-array
 * fast path and the sequential deep (`@`) matcher. Standalone: depends only on
 * the operator registry and pure tree utils, so it is independently testable.
 */

export interface StrictOperatorContext {
  warnedUnknownOps: Set<string>;
  warnings: string[];
}

export function compileCriterion(key: string, operator: ComparisonOperator, value: unknown): CompiledCriterion {
  const deep = parseDeepSearchPath(key);
  return {
    segments: deep.isDeep ? deep.searchSegments : splitPath(key),
    operator,
    value,
    opFn: getOperatorFn(operator),
    knownOperator: isOperatorKnown(String(operator)),
    isDeep: deep.isDeep,
    deepArrayKey: deep.arrayKey,
  };
}

/** Apply the `operatorsStrict` policy for a possibly-unknown operator. */
export function enforceKnownOperator(
  criterion: CompiledCriterion,
  options: Readonly<SearchOptions>,
  ctx: StrictOperatorContext
): void {
  if (criterion.knownOperator) return;
  const mode = options.operatorsStrict;
  if (mode === 'throw') {
    throw new Error(`jsnq: unknown comparison operator '${String(criterion.operator)}'`);
  }
  if (mode === 'warn') {
    const key = String(criterion.operator);
    if (!ctx.warnedUnknownOps.has(key)) {
      ctx.warnedUnknownOps.add(key);
      ctx.warnings.push(`unknown comparison operator '${key}'`);
    }
  }
}

/**
 * Standard (non-deep) criterion check against a node value: the first segment
 * must be present on the node (array index in range / own object key), then the
 * extracted value is compared via the registered operator.
 */
export function criterionMatches(criterion: CompiledCriterion, data: unknown): boolean {
  const seg0 = criterion.segments[0];
  if (seg0 !== undefined) {
    if (Array.isArray(data)) {
      if (seg0 === 'length') {
        if (criterion.segments.length === 1) return criterion.opFn(data.length, criterion.value);
      } else {
        const idx = Number(seg0);
        if (Number.isNaN(idx) || idx < 0 || idx >= data.length) return false;
        // Single-segment fast path for array nodes: the value is the element itself (index
        // validated above). Direct indexing beats the generic segment walk ~4x here; the
        // object and multi-segment paths are left byte-identical to avoid any JIT regression.
        if (criterion.segments.length === 1) return criterion.opFn(data[idx], criterion.value);
      }
    } else if (isObject(data)) {
      if (!(seg0 in data)) return false;
    } else {
      return false;
    }
  }
  const val = getBySegments(data, criterion.segments);
  return criterion.opFn(val, criterion.value);
}

/**
 * Full criteria conjunction (deep `@` criteria included) with strict-operator
 * policy applied per criterion, in order, stopping at the first failure.
 */
export function criteriaMatch(
  criteria: ReadonlyArray<CompiledCriterion>,
  data: unknown,
  options: Readonly<SearchOptions>,
  ctx: StrictOperatorContext
): boolean {
  for (let i = 0; i < criteria.length; i++) {
    const c = criteria[i];
    enforceKnownOperator(c, options, ctx);
    if (c.isDeep) {
      if (!deepArrayMatch(data, c.deepArrayKey, c.segments, c.opFn, c.value, options.maxDepth ?? 10)) return false;
      continue;
    }
    if (!criterionMatches(c, data)) return false;
  }
  return true;
}
