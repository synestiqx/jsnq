export type ComparisonOperator =
  | '=='
  | '==='
  | '!='
  | '!=='
  | '>'
  | '>='
  | '<'
  | '<='
  | 'includes'
  | '!includes'
  | 'startsWith'
  | 'endsWith'
  | 'regex'
  | 'isArray'
  | 'isObject'
  | (string & {});

// Stronger typing helpers (optional, non-breaking)
export type Primitive = string | number | boolean | null | undefined;
export type JsonLike = Primitive | JsonLike[] | { [k: string]: JsonLike };

// Build path strings for object/array structures
// Supports:
//  - dot notation: users.0.name
//  - bracket index notation for arrays: users[0].name
// To avoid TS "excessively deep" errors, use a depth-limited recursion helper.
type _Prev = [never, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

// Helper types for path construction
type ArrayPathSegment<D extends number> = `${number}` | `[${number}]`;
type NestedArrayPath<T, D extends number> = D extends 0 ? never : `${number}.${PathRec<T, _Prev[D]>}` | `[${number}].${PathRec<T, _Prev[D]>}`;
type ObjectPathSegment<K extends string, V, D extends number> = `${K}` | (D extends 0 ? never : `${K}.${PathRec<V, _Prev[D]>}`);

type PathRec<T, D extends number> =
  T extends ReadonlyArray<infer U> | (infer U)[]
    ? // array: numeric or bracketed index, optionally followed by nested path
      ArrayPathSegment<D> | NestedArrayPath<U, D>
    : T extends object
      ? // object: key or nested key
        { [K in Extract<keyof T, string>]: ObjectPathSegment<K, T[K], D> }[Extract<keyof T, string>]
      : never;

// Public default: depth 6 (tunable via advanced alias below)
export type Path<T> = PathRec<T, 6>;
export type PathWithDepth<T, D extends number> = PathRec<T, D>;

// Split a string type by '.'
export type Split<S extends string> = S extends `${infer A}.${infer B}` ? [A, ...Split<B>] : [S];

// Helper types for path value resolution
type PathValueArrayCase<T, K extends string, R extends string> = K extends `${number}`
  ? T extends ReadonlyArray<infer U> | (infer U)[]
    ? PathValueRec<U, R>
    : unknown
  : K extends keyof T
    ? PathValueRec<T[K], R>
    : unknown;

type PathValueBaseCase<T, K extends string> = K extends `${number}`
  ? T extends ReadonlyArray<infer U> | (infer U)[] ? U : unknown
  : K extends keyof T ? T[K] : unknown;

// Resolve value type at given path
// PathValue recursion is naturally bounded by P's length, so no explicit depth cap needed
type PathValueRec<T, P extends string> =
  P extends `${infer K}.${infer R}`
    ? PathValueArrayCase<T, K, R>
    : P extends `${infer K}`
      ? PathValueBaseCase<T, K>
      : unknown;

export type PathValue<T, P extends string> = PathValueRec<T, P>;

// Narrow built-in operators by value type (keeps registry extensibility)
export type EqualityOps = '==' | '===' | '!=' | '!==';
export type NumericOps = EqualityOps | '<' | '<=' | '>' | '>=';
export type StringOps = EqualityOps | 'includes' | '!includes' | 'startsWith' | 'endsWith' | 'regex';
export type ArrayOps = EqualityOps | 'includes' | '!includes';

// Helper types for operator combinations
export type ComparisonOps = EqualityOps | '<' | '<=' | '>' | '>=';
export type PatternOps = 'includes' | '!includes' | 'startsWith' | 'endsWith' | 'regex';
export type TypeCheckOps = 'isArray' | 'isObject';

export type OperatorFor<V> =
  V extends number ? ComparisonOps | PatternOps :
  V extends string ? ComparisonOps | PatternOps :
  V extends boolean ? EqualityOps :
  V extends ReadonlyArray<unknown> | unknown[] ? ComparisonOps | PatternOps :
  EqualityOps | TypeCheckOps | (string & {});

export interface CompiledCriterion {
  segments: string[];
  operator: ComparisonOperator;
  value: unknown;
  opFn: (a: unknown, b: unknown) => boolean;
  knownOperator: boolean;
  // Deep array search support
  isDeep?: boolean;
  deepArrayKey?: string;  // nazwa klucza tablicy dla deep search (np. "fields", "layout")
}

export type InsertPosition = 'inside' | 'before' | 'after';

// Array merge strategies for deep merge operations
export type ArrayMergeStrategy = 'replace' | 'concat' | 'merge-by-key';

export type ActionType =
  | 'replace'
  | 'update'
  | 'merge_update'
  | 'delete_key'
  | 'delete_element'
  | 'insert'
  | 'insert_to'
  | 'move'
  | 'move_matches'
  | 'move_matches_overwrite'
  | 'copy'
  | 'copy_matches'
  | 'move_first_to_matches'
  | 'copy_first_to_matches';

/**
 * Metadata attached to JsonOperator functions for optimized detection
 */
export interface OperatorMetadata {
  /** Flag indicating if operator performs mutations (vs. queries) */
  __isMutation?: boolean;
  /** Cache key for operator memoization */
  __cacheKey?: string;
}

// Helper types for action properties
type ActionKey = string | number;
type ActionValue = unknown | ((current: unknown, node: unknown) => unknown);
type ActionMode = InsertPosition | undefined;

export interface BaseAction { type: ActionType; }

/**
 * Shared shape of the move/copy "matches" action family: select targets by
 * (targetKey, targetOperator, targetValue) and insert with mode/key semantics.
 * key: array index for inside on arrays; string key for objects.
 */
interface TargetMatchAction<T extends ActionType> extends BaseAction {
  type: T;
  targetKey: string;
  targetOperator: ComparisonOperator;
  targetValue: unknown;
  mode?: ActionMode;
  key?: ActionKey;
}

export interface ReplaceAction extends BaseAction {
  type: 'replace';
  key: string;
  value: ActionValue;
}

export interface UpdateAction extends BaseAction {
  type: 'update';
  key: string;
  value: ActionValue;
}

export interface MergeUpdateAction extends BaseAction {
  type: 'merge_update';
  key: string;
  patch: Record<string, unknown>;
  deep?: boolean; // optional deep merge flag
}

export interface DeleteKeyAction extends BaseAction { type: 'delete_key'; key: string; }
export interface DeleteElementAction extends BaseAction { type: 'delete_element'; }

export interface InsertAction extends BaseAction {
  type: 'insert';
  data: unknown;
  position: InsertPosition;
  key?: ActionKey; // string for object key; number = array index when inside
}

export interface MoveAction extends BaseAction {
  type: 'move';
  position: string;
  mode?: ActionMode;
  key?: ActionKey; // when inside and target is array: numeric index
}

export interface InsertToAction extends BaseAction {
  type: 'insert_to';
  data: unknown;
  position: string;
  mode?: ActionMode;
  key?: ActionKey; // when inside and target is array: numeric index
}

export interface MoveMatchesAction extends TargetMatchAction<'move_matches'> {}

export interface MoveMatchesOverwriteAction extends BaseAction {
  type: 'move_matches_overwrite';
  targetKey: string;
  targetOperator: ComparisonOperator;
  targetValue: unknown;
  overwriteKey: string;
}

export interface CopyAction extends BaseAction {
  type: 'copy';
  position: string;
  mode?: ActionMode;
  key?: ActionKey; // when inside and target is array: numeric index
}

export interface CopyMatchesAction extends TargetMatchAction<'copy_matches'> {}

export interface MoveFirstToMatchesAction extends TargetMatchAction<'move_first_to_matches'> {}

export interface CopyFirstToMatchesAction extends TargetMatchAction<'copy_first_to_matches'> {}

export type Action =
  | ReplaceAction
  | UpdateAction
  | MergeUpdateAction
  | DeleteKeyAction
  | DeleteElementAction
  | InsertAction
  | InsertToAction
  | MoveAction
  | MoveMatchesAction
  | MoveMatchesOverwriteAction
  | CopyAction
  | CopyMatchesAction
  | MoveFirstToMatchesAction
  | CopyFirstToMatchesAction;

export interface SearchOptions {
  maxDepth?: number;
  includeArrays?: boolean;
  includeObjects?: boolean;
  earlyTermination?: boolean;
  limit?: number;
  buildMeta?: boolean;
  returnPaths?: boolean;
  immutable?: boolean | 'auto'; // true or 'auto' (clone only if there are mutating actions)
  dryRun?: boolean;    // don't mutate; only collect planned operations and stats
  strictPathsWarn?: boolean; // add warnings on implicit path creation or missing segments
  operatorsStrict?: 'warn' | 'throw'; // behavior for unknown comparison operators
  // Deep merge array behavior
  arrayMergeStrategy?: ArrayMergeStrategy; // default: 'replace'
  arrayMergeKey?: string | ((x: unknown) => string | number); // required when strategy = 'merge-by-key'
  // Overwrite behavior when inserting into object targets
  overwritePolicy?: 'overwrite' | 'skip' | 'error'; // default: 'overwrite'
  warnOnOverwrite?: boolean; // default: true
  // Warn that before/after on objects has no stable order semantics
  objectOrderWarning?: boolean; // default: true
  /**
   * When false, skips `stats.operations.push(...)` in hot paths. The `operations` array
   * stays initialized (empty) but no string allocation/push happens per action. Default
   * true (preserves public stats API). Host commit fast paths set this to false since
   * they never inspect operation labels — removes O(matches × actions) string allocations
   * from the mutate hot path.
   */
  trackOperations?: boolean; // default: true
}

// Traversal result node with generics (defaults keep back-compat)
export interface SearchResultNode<TData = unknown, TParent = unknown, TKey extends string | number = string | number> {
  data: TData;
  path?: string[];
  depth: number;
  parent?: TParent;
  parentKey?: TKey;
}

export interface PipelineStats {
  searchTime: number;
  nodesVisited: number;
  resultsFound: number;
  maxDepth: number;
  // extended metrics (required to simplify usage without casts)
  replaces: number;
  updates: number;
  mergeUpdates: number;
  deletedKeys: number;
  deletedElements: number;
  inserted: number;
  moved: number;
  copied: number;
  warnings: string[];
  operations: string[];
}

export interface PipelineLike<TData extends JsonLike = JsonLike> {
  readonly data: TData;
  readonly criteria: ReadonlyArray<CompiledCriterion>;
  readonly actions: ReadonlyArray<Action>;
  readonly options: Readonly<SearchOptions>;
  // Return a generic PipelineLike<TData> to avoid casts to `this` in implementations
  with(next: { data?: TData; options?: SearchOptions; criteria?: CompiledCriterion[]; actions?: Action[] }): PipelineLike<TData>;
}

// JsonOperator: a function that accepts a PipelineLike and returns a new PipelineLike
// Operators may have metadata attached for optimization (mutation detection, caching)
export type JsonOperator<T extends PipelineLike = PipelineLike> = ((pipeline: T) => T) & Partial<OperatorMetadata>;

// Helper for key type by target value type
export type KeyFor<V> = V extends ReadonlyArray<unknown> | unknown[] ? number : string;

// Bracket-path type support (array indexes as [number])
type BracketPathRec<T, D extends number> =
  T extends ReadonlyArray<infer U> | (infer U)[]
    ? `[${number}]` | (D extends 0 ? never : `[${number}].${BracketPathRec<U, _Prev[D]>}`)
    : T extends object
      ? { [K in Extract<keyof T, string>]: `${K}` | (D extends 0 ? never : `${K}.${BracketPathRec<T[K], _Prev[D]>}`) }[Extract<keyof T, string>]
      : never;

export type BracketPath<T> = BracketPathRec<T, 6>;
export type BracketPathWithDepth<T, D extends number> = BracketPathRec<T, D>;
