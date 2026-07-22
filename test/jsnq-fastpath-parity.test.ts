/**
 * test-jsnq-fastpath-parity.ts
 *
 * Contract tests for core/pipeline-fastpath.ts — the COW flat-array engine used
 * by host mutate() flows (Angular GenericProxyHandler, solid-pipeline-bridge).
 * For every guarded scenario the fast path must produce byte-equal data to the
 * full clone+JsnqPipeline flow; for everything outside the guard it must return
 * undefined so callers fall back to the pipeline unchanged.
 */

import {
  JsnqPipeline,
  type JsonLike,
  type SearchResultNode,
  applyDeepSugarPatch,
  cloneJsonData,
  collectPipelineIntent,
  deleteKey,
  insert,
  insertTo,
  mergeUpdate,
  tryFastPipelineMutation,
  tryFastStructuralMutation,
  update,
  where,
} from '../src/synced';

type Row = {
  id: number;
  active: boolean;
  name: string;
  meta: { score: number; tag?: string };
  children?: Array<{ id: number }>;
  status?: string;
};

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean): void {
  if (cond) { passed++; console.log(`✅ ${name}`); }
  else { failed++; console.error(`❌ ${name}`); }
}

function rows(): Row[] {
  return [
    { id: 1, active: true, name: 'one', meta: { score: 10, tag: 'a' } },
    { id: 2, active: false, name: 'two', meta: { score: 20, tag: 'b' } },
    { id: 3, active: true, name: 'three', meta: { score: 30, tag: 'c' } },
  ];
}

function viaPipeline(input: unknown, ops: Array<(p: JsnqPipeline) => JsnqPipeline>): { data: unknown; mutations: number; matched: number } {
  let pipeline = new JsnqPipeline(cloneJsonData(input) as JsonLike);
  for (const op of ops) pipeline = op(pipeline);
  pipeline.all();
  const stats = pipeline.getStats();
  return {
    data: pipeline.data,
    mutations: stats.replaces + stats.updates + stats.mergeUpdates + stats.deletedKeys,
    matched: stats.resultsFound,
  };
}

function expectParity(name: string, input: unknown, ops: Array<(p: JsnqPipeline) => JsnqPipeline>): void {
  const snapshot = JSON.stringify(input);
  const fast = tryFastPipelineMutation(input, ops);
  check(`${name}: fast path engages`, fast !== undefined);
  if (!fast) return;
  const ref = viaPipeline(input, ops);
  check(`${name}: data parity with pipeline`, JSON.stringify(fast.value) === JSON.stringify(ref.data));
  check(`${name}: mutation count parity`, fast.mutations === ref.mutations);
  check(`${name}: matched count parity`, fast.matched === ref.matched);
  check(`${name}: input not mutated`, JSON.stringify(input) === snapshot);
}

function expectBail(name: string, input: unknown, ops: Array<(p: JsnqPipeline) => JsnqPipeline>): void {
  check(`${name}: bails to full pipeline`, tryFastPipelineMutation(input, ops) === undefined);
}

// --- Guarded scenarios: must be byte-equal to the pipeline ---

expectParity('where + update(fn)', rows(), [
  where('meta.score', '>', 15),
  update('name', (current: unknown) => `${current}!`),
]);

// Sugar update({patch}) is NOT representable in the raw pipeline (its key must be a
// string path) — the fast path implements the solid-pipeline-bridge semantics here:
// shallow-assign the patch onto each matched item. Assert semantics, not parity.
(() => {
  const input = rows();
  const fast = tryFastPipelineMutation(input, [
    where('id', '==', 2),
    update({ status: 'done' } as never, undefined as never),
  ]);
  if (!fast) { check('sugar patch: fast path engages', false); return; }
  const next = fast.value as Row[];
  check('sugar patch: applied to matched item', next[1].status === 'done' && next[1].name === 'two');
  check('sugar patch: unmatched untouched + shared', next[0] === input[0] && next[2] === input[2]);
  check('sugar patch: input not mutated', input[1].status === undefined);
  check('sugar patch: counts', fast.mutations === 1 && fast.matched === 1);
})();

expectParity('where + mergeUpdate', rows(), [
  where('active', '===', true),
  mergeUpdate('meta', { extra: 1 } as never),
]);

expectParity('where + deleteKey nested', rows(), [
  where('active', '===', true),
  deleteKey('meta.tag'),
]);

expectParity('multi-where + multi-action', rows(), [
  where('active', '===', true),
  where('meta.score', '>=', 30),
  update('name', 'matched'),
  deleteKey('meta.tag'),
]);

expectParity('no-match where', rows(), [
  where('id', '==', 999),
  update('name', 'never'),
]);

for (const [operator, value] of [
  ['!=', 1],
  ['!==', 1],
  ['!includes', 'x'],
  ['isArray', false],
  ['isObject', false],
] as const) {
  expectParity(`missing criterion key + ${operator}`, [
    { id: 1, name: 'present' },
    { name: 'missing' },
    { id: undefined, name: 'undefined' },
  ], [
    where('id', operator, value as never),
    update('name', 'changed'),
  ]);
}

expectParity('implicit path creation', rows(), [
  where('id', '==', 1),
  update('meta.brandNew.flag', true),
]);

// --- Identity contract (the COW part the pipeline cannot promise) ---

(() => {
  const input = rows();
  const fast = tryFastPipelineMutation(input, [
    where('id', '==', 2),
    update('name', 'changed'),
  ]);
  if (!fast) { check('identity: fast path engages', false); return; }
  const next = fast.value as Row[];
  check('identity: returns new outer array', next !== input);
  check('identity: unmatched items shared by reference', next[0] === input[0] && next[2] === input[2]);
  check('identity: matched item is a fresh clone', next[1] !== input[1]);
  check('identity: untouched nested objects remain shared', next[1].meta === input[1].meta);
  check('identity: input row untouched', input[1].name === 'two');
  check('identity: mutations counted', fast.mutations === 1 && fast.matched === 1);
  check('identity: precise paths include item and leaf',
    JSON.stringify(fast.affectedPaths) === JSON.stringify(['1', '1.name']));
})();

(() => {
  const input = rows();
  const fast = tryFastPipelineMutation(
    input,
    [where('id', '==', 2), update('name', 'changed')],
    { collectAffectedPaths: false },
  );
  check('no-path host mode: fast path engages', fast !== undefined);
  if (!fast) return;
  const next = fast.value as Row[];
  check('no-path host mode: preserves mutation result', next[1].name === 'changed' && input[1].name === 'two');
  check('no-path host mode: preserves counts', fast.matched === 1 && fast.mutations === 1);
  check('no-path host mode: omits affected path allocation', fast.affectedPaths === null);
})();

(() => {
  const input = [{ id: 1, value: 'before' }];
  const pipeline = new JsnqPipeline(input as JsonLike, { immutable: true })
    .pipe(where('id', '===', 1), update('value', 'after'));
  const result = pipeline.all()[0] as SearchResultNode<any>;
  check('immutable all(): result is the mutated working item', result.data.value === 'after');
  check('immutable all(): result and pipeline data share the working item', result.data === (pipeline.data as any[])[0]);

  const first = new JsnqPipeline(input as JsonLike, { immutable: true })
    .pipe(where('id', '===', 1), update('value', 'after'))
    .first<{ id: number; value: string }>();
  check('immutable first(): returns the mutated item', first?.value === 'after');
})();

(() => {
  const input = [{ id: 1, value: 'before' }];
  const pipeline = new JsnqPipeline(input as JsonLike)
    .dryRun()
    .pipe(where('id', '===', 1), update('value', 'after'));
  const results = pipeline.all();
  check('compiled dryRun returns matching result nodes', results.length === 1 && (results[0].data as any).value === 'before');
  check('compiled dryRun does not mutate input', input[0].value === 'before');
  check('compiled dryRun preserves planned update stats', pipeline.getStats().updates === 1);
})();

(() => {
  const specialValues: unknown[] = [NaN, Infinity, -0, 1n, new Date('2024-01-02T03:04:05Z')];
  for (const value of specialValues) {
    const fast = tryFastPipelineMutation([{ id: 1, value: null }], [
      where('id', '===', 1),
      update('value', value as never),
    ]);
    const actual = (fast?.value as Array<{ value: unknown }>)[0].value;
    check(`compiled action preserves ${Object.prototype.toString.call(value)}`, Object.is(actual, value));
  }

  const shared = { nested: true };
  const fast = tryFastPipelineMutation([{ id: 1 }, { id: 2 }], [
    where('id', '>=', 1),
    update('shared', shared as never),
  ]);
  const next = fast?.value as Array<{ shared: object }>;
  check('compiled action preserves shared object identity', next[0].shared === shared && next[1].shared === shared);
})();

(() => {
  const input = [{ id: 1 }];
  const fast = tryFastPipelineMutation(input, [where('id', '===', 2), update('id', 3)]);
  check('compiled zero-match keeps outer array identity', fast?.value === input);
})();

// --- Out-of-guard shapes: must return undefined (caller runs the pipeline) ---

expectBail('non-array root', { users: rows() }, [
  where('id', '==', 1),
  update('name', 'x'),
]);

expectBail('no criteria', rows(), [update('name', 'x')]);

expectBail('structural action (insert)', rows(), [
  where('id', '==', 1),
  insert({ id: 99 } as never),
]);

expectBail('deep @ criterion', rows(), [
  where('children@id', '==', 1),
  update('name', 'x'),
]);

expectBail('empty-string action key', rows(), [
  where('id', '==', 1),
  update('', 'x'),
]);

expectBail('nested criterion candidate', [
  { id: 1, children: [{ id: 2 }] },
], [
  where('id', '==', 2),
  update('name', 'x'),
]);

expectBail('non-function op', rows(), [{ raw: true } as never]);

/* ========================================================================== */
/*           Flat pipeline relative-insert fast path — semantics              */
/* ========================================================================== */

(() => {
  const marker = { id: 99 };
  const data = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }];
  const pipeline = new JsnqPipeline(data).pipe(
    where('id', '>=', 2),
    insert(marker as never, 'after'),
  );
  const results = pipeline.all();
  check('flat relative insert after: preserves declared ordering',
    data.map((item) => item.id).join(',') === '1,2,99,3,99,4,99');
  check('flat relative insert after: preserves payload identity',
    data[2] === marker && data[4] === marker && data[6] === marker);
  check('flat relative insert after: result and stats parity',
    results.length === 3 && pipeline.getStats().inserted === 3);
})();

(() => {
  const data = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }];
  new JsnqPipeline(data).pipe(
    where('id', '>=', 2),
    insert({ id: 88 } as never, 'before'),
  ).all();
  check('flat relative insert before: preserves declared ordering',
    data.map((item) => item.id).join(',') === '1,88,2,88,3,88,4');
})();

(() => {
  const data = [{ id: 1, children: [{ id: 2 }] }];
  new JsnqPipeline(data).pipe(
    where('id', '===', 2),
    insert({ id: 3 } as never, 'after'),
  ).all();
  check('flat relative insert: nested candidate falls back to DFS',
    data[0]!.children.map((item) => item.id).join(',') === '2,3');
})();

/* ========================================================================== */
/*        Structural shortcuts (tryFastStructuralMutation) — parity           */
/* ========================================================================== */

function viaStructural(input: unknown, ops: Array<(p: JsnqPipeline) => JsnqPipeline>): unknown | undefined {
  return tryFastStructuralMutation(input, collectPipelineIntent(ops))?.value;
}

function expectStructuralParity(name: string, input: unknown, ops: Array<(p: JsnqPipeline) => JsnqPipeline>): void {
  const snapshot = JSON.stringify(input);
  const fast = viaStructural(input, ops);
  check(`${name}: structural fast path engages`, fast !== undefined);
  if (fast === undefined) return;
  const ref = viaPipeline(input, ops);
  check(`${name}: data parity with pipeline`, JSON.stringify(fast) === JSON.stringify(ref.data));
  check(`${name}: input not mutated`, JSON.stringify(input) === snapshot);
}

function expectStructuralBail(name: string, input: unknown, ops: Array<(p: JsnqPipeline) => JsnqPipeline>): void {
  check(`${name}: structural bails to full pipeline`, viaStructural(input, ops) === undefined);
}

expectStructuralParity('insert push at array root', [1, 2, 3], [insert(99 as never)]);
expectStructuralParity('insert at numeric key (splice)', [1, 2, 3], [insert(99 as never, 'inside', 1)]);
expectStructuralParity('insert numeric key clamped', [1, 2], [insert(99 as never, 'inside', 50)]);
expectStructuralParity('delete_key on flat items', rows().map(({ meta, ...flat }) => flat), [deleteKey('name')]);
expectStructuralParity('delete_key with primitive items mixed in', [1, { x: 'a', y: 2 }, 'str'], [deleteKey('x')]);
expectStructuralParity('insertTo inside existing array', { a: { list: [1, 2] }, b: { untouched: true } }, [
  insertTo('a.list', 7 as never, 'inside'),
]);

// insert before/after interleaves at EVERY element in the pipeline — must not shortcut.
expectStructuralBail('insert before (interleave semantics)', [1, 2, 3], [insert(99 as never, 'before')]);
// Nested objects can hide the key at depth > 1 (pipeline strips those too) — must not shortcut.
expectStructuralBail('delete_key with nested item', rows(), [deleteKey('meta')]);
expectStructuralBail('insertTo with before mode', { a: { list: [1, 2] } }, [insertTo('a.list.1', 9 as never, 'before')]);
expectStructuralBail('insertTo non-array target', { a: { obj: { x: 1 } } }, [insertTo('a.obj', 9 as never, 'inside')]);
expectStructuralBail('structural with criteria present', rows(), [where('id', '==', 1), insert({ id: 9 } as never)]);

// The bail above must be NECESSARY: pipeline really does strip nested keys.
(() => {
  const input = [{ id: 1, x: 'top', nested: { x: 'deep', keep: 1 } }];
  const ref = viaPipeline(input, [deleteKey('x')]).data as Array<{ nested: { x?: string; keep: number } }>;
  check('delete_key nested bail is necessary (pipeline strips deep keys)', ref[0].nested.x === undefined && ref[0].nested.keep === 1);
})();

// COW identity for structural shortcuts.
(() => {
  const input = { a: { list: [1, 2] }, b: { untouched: true } } as { a: { list: number[] }; b: { untouched: boolean } };
  const next = viaStructural(input, [insertTo('a.list', 7 as never, 'inside')]) as typeof input;
  check('insertTo COW: returns new root', next !== input);
  check('insertTo COW: untouched branch shared by reference', next.b === input.b);
  check('insertTo COW: target array is fresh', next.a.list !== input.a.list && next.a.list.length === 3);
  check('insertTo COW: input untouched', input.a.list.length === 2);
})();

(() => {
  const item = { id: 1 };
  const input = [item];
  const next = viaStructural(input, [insert({ id: 2 } as never)]) as Array<{ id: number }>;
  check('insert COW: returns new array, existing items shared', next !== input && next[0] === item && next.length === 2);
})();

/* ========================================================================== */
/*              Sugar deep patch (applyDeepSugarPatch) — semantics            */
/* ========================================================================== */

(() => {
  const input = { user: { profile: { settings: { theme: 'light' }, name: 'Ada' } } };
  const ops = [where('user.profile.settings.theme', '==', 'light'), update({ theme: 'dark' } as never, undefined as never)];
  const intent = collectPipelineIntent(ops);
  const next = applyDeepSugarPatch(input, intent.criteria, intent.actions) as typeof input;
  check('sugar deep: patch assigned at parent of where leaf', next.user.profile.settings.theme === 'dark');
  check('sugar deep: siblings preserved', next.user.profile.name === 'Ada');
  check('sugar deep: input not mutated', input.user.profile.settings.theme === 'light');
})();

(() => {
  const input = { user: { profile: { settings: { theme: 'light' }, name: 'Ada' } } };
  const falseIntent = collectPipelineIntent([
    where('user.profile.settings.theme', '===', 'dark'),
    update({ theme: 'blue' } as never, undefined as never),
  ]);
  const falseResult = applyDeepSugarPatch(input, falseIntent.criteria, falseIntent.actions);
  check('sugar deep: false criterion preserves input identity', falseResult === input);

  const missingIntent = collectPipelineIntent([
    where('user.profile.missing', '===', true),
    update({ missing: false } as never, undefined as never),
  ]);
  check('sugar deep: missing criterion does not patch', applyDeepSugarPatch(input, missingIntent.criteria, missingIntent.actions) === input);

  const multiIntent = collectPipelineIntent([
    where('user.profile.settings.theme', '===', 'light'),
    where('user.profile.name', '===', 'Other'),
    update({ theme: 'blue' } as never, undefined as never),
  ]);
  check('sugar deep: all criteria must match', applyDeepSugarPatch(input, multiIntent.criteria, multiIntent.actions) === input);
})();

(() => {
  const input = { a: null as null | { wasNull: boolean }, keep: 1 };
  const ops = [where('a', '==', null), update({ wasNull: true } as never, undefined as never)];
  const intent = collectPipelineIntent(ops);
  const next = applyDeepSugarPatch(input, intent.criteria, intent.actions) as { a: { wasNull: boolean }; keep: number };
  check('sugar deep: null leaf slot replaced by patch', next.a !== null && next.a.wasNull === true);
  check('sugar deep: untouched keys preserved', next.keep === 1 && input.a === null);
})();

console.log(`\njsnq-fastpath-parity: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
