/**
 * Edge-case correctness net for the criteria matcher + operators — guards the v2
 * single-segment fast path in criterionMatches (and any future perf work).
 * Run: bun test/jsondb-edge-cases.test.ts
 */
import { JsonPipeline } from '../src/synced';
import where from '../src/synced/operators/where';
import { compileCriterion, criterionMatches, criteriaMatch } from '../src/synced/core/match';

let failures = 0;
function ok(cond: unknown, msg: string): void {
  if (!cond) { failures++; console.error(`❌ ${msg}`); } else { console.log(`✅ ${msg}`); }
}
const ctx = () => ({ warnedUnknownOps: new Set<string>(), warnings: [] as string[] });
const match1 = (key: string, op: any, value: unknown, data: unknown) =>
  criterionMatches(compileCriterion(key, op, value), data);

// --- single-segment value extraction (the fast-path under test) ---
ok(match1('active', '===', true, { active: true }) === true, 'single-seg object: present + equal');
ok(match1('active', '===', true, { active: false }) === false, 'single-seg object: present + not equal');
ok(match1('missing', '===', 1, { a: 1 }) === false, 'single-seg object: absent key => no match');
ok(match1('a', '===', undefined, { a: undefined }) === true, 'single-seg object: present key with undefined value matches ===undefined');
ok(match1('a', '===', undefined, { b: 1 }) === false, 'single-seg object: absent key !== present-undefined');

// numeric-looking OBJECT key (not an array) must read the own key, not be treated as index
ok(match1('0', '===', 'x', { '0': 'x' }) === true, 'single-seg object: numeric-string own key');

// array element-as-array indexing
ok(match1('0', '===', 10, [10, 20]) === true, 'single-seg array: index 0 in range');
ok(match1('5', '===', 10, [10, 20]) === false, 'single-seg array: index out of range => no match');
ok(match1('x', '===', 1, 'a-string') === false, 'single-seg on primitive => no match');

// dotted key via bracket-quote path stays ONE segment (must NOT split on the dot)
ok(match1('["first.name"]', '===', 'Ann', { 'first.name': 'Ann' }) === true, 'dotted key (bracket-quoted) reads the literal key');
ok(match1('["first.name"]', '===', 'Ann', { first: { name: 'Ann' } }) === false, 'dotted key does NOT descend into first.name');

// --- multi-segment still resolves through the full walker ---
ok(match1('meta.group', '===', 1, { meta: { group: 1 } }) === true, 'multi-seg nested match');
ok(match1('meta.group', '===', 1, { meta: {} }) === false, 'multi-seg missing leaf => no match');
ok(match1('meta.group', '===', 1, {}) === false, 'multi-seg missing head => no match');

// --- operator coverage through the matcher ---
ok(match1('tags', 'includes', 'b', { tags: ['a', 'b'] }) === true, 'op includes (array)');
ok(match1('name', 'startsWith', 'Ad', { name: 'Ada' }) === true, 'op startsWith');
ok(match1('name', 'endsWith', 'da', { name: 'Ada' }) === true, 'op endsWith');
ok(match1('name', 'regex', '^A.a$', { name: 'Ada' }) === true, 'op regex');
ok(match1('score', '>', 50, { score: 51 }) === true, 'op > numeric');
ok(match1('score', '<=', 50, { score: 50 }) === true, 'op <= numeric');
ok(match1('items', 'isArray', null, { items: [] }) === true, 'op isArray');
ok(match1('meta', 'isObject', null, { meta: {} }) === true, 'op isObject');

// --- conjunction (criteriaMatch) honors all criteria ---
const conj = [compileCriterion('active', '===', true), compileCriterion('score', '>', 50)];
ok(criteriaMatch(conj, { active: true, score: 60 }, {}, ctx()) === true, 'AND: both match');
ok(criteriaMatch(conj, { active: true, score: 10 }, {}, ctx()) === false, 'AND: second fails');

// --- end-to-end through the pipeline (scan parity with the matcher) ---
const flat = Array.from({ length: 100 }, (_, i) => ({ id: i, active: i % 2 === 0, score: i }));
const scanned = new JsonPipeline(flat as never, { returnPaths: false, buildMeta: false })
  .pipe(where('active', '===', true), where('score', '>', 50)).all();
ok(scanned.length === 24, `pipeline scan single-seg criteria (got ${scanned.length}, want 24)`);

// nested DFS where a deep node matches the same head key (must still find it)
const nested = { a: { id: 7 }, b: { c: { id: 7 } } };
const deep = new JsonPipeline(nested as never).pipe(where('id', '===', 7)).all();
ok(deep.length === 2, `nested DFS finds both id:7 nodes (got ${deep.length})`);

if (failures > 0) {
  console.error(`\n${failures} edge-case assertion(s) FAILED`);
  process.exit(1);
}
console.log('\nAll jsondb edge-case tests passed.');
