import {
  JsnqPipeline,
  copyTo,
  copyToAll,
  insert,
  insertTo,
  mergeUpdate,
  moveTo,
  moveToAll,
  moveToMatches,
  moveToMatchesOverwrite,
  where,
} from '../src/synced';
import { removeFromOriginal } from '../src/synced/core/ops';

let passed = 0;
let failed = 0;

function check(name: string, condition: boolean): void {
  if (condition) {
    passed++;
    console.log(`PASS ${name}`);
  } else {
    failed++;
    console.error(`FAIL ${name}`);
  }
}

{
  const data = { source: [{ kind: 'item', id: 1 }], target: [] as Array<{ kind: string; id: number }> };
  new JsnqPipeline(data).pipe(where('kind', '===', 'item'), copyTo('target')).all();
  check('copyTo does not re-match its inserted clone during DFS', data.target.length === 1);
}

{
  const data = { source: [{ kind: 'item', id: 1 }], target: [] as Array<{ kind: string; id: number }> };
  new JsnqPipeline(data).pipe(where('kind', '===', 'item'), moveTo('target')).all();
  check('moveTo does not re-match its moved node during DFS', data.source.length === 0 && data.target.length === 1);
}

{
  const data = {
    source: [{ kind: 'source', nested: { value: 1 } }],
    targets: [{ kind: 'target' }, { kind: 'target' }] as Array<Record<string, unknown>>,
  };
  new JsnqPipeline(data)
    .pipe(where('kind', '===', 'source'), moveToMatchesOverwrite('kind', '===', 'target', 'slot'))
    .all();
  const first = data.targets[0].slot as { nested: { value: number } };
  const second = data.targets[1].slot as { nested: { value: number } };
  check(
    'moveToMatchesOverwrite isolates mutable values across targets',
    data.source.length === 0 && first !== second && first.nested !== second.nested,
  );
}

{
  const source = { kind: 'source', id: 1 };
  const occupied = { id: 99 };
  const data = { source: [source], target: { slot: occupied } };
  const pipeline = new JsnqPipeline(data, { overwritePolicy: 'skip' })
    .pipe(where('kind', '===', 'source'), moveTo('target', 'inside', 'slot'));
  pipeline.all();
  check(
    'moveTo overwritePolicy skip preserves source and target without false moved stats',
    data.source[0] === source && data.target.slot === occupied && pipeline.getStats().moved === 0,
  );
}

{
  const data = { source: [{ kind: 'source', id: 1 }], target: { slot: { id: 99 } } };
  const pipeline = new JsnqPipeline(data, { overwritePolicy: 'error' })
    .pipe(where('kind', '===', 'source'), moveTo('target', 'inside', 'slot'));
  let threw = false;
  try {
    pipeline.all();
  } catch {
    threw = true;
  }
  check(
    'moveTo overwritePolicy error throws before source removal',
    threw && data.source.length === 1 && (data.target.slot as { id: number }).id === 99 && pipeline.getStats().moved === 0,
  );
}

{
  const data = { target: { slot: { id: 99 } } };
  const pipeline = new JsnqPipeline(data, { overwritePolicy: 'skip' })
    .pipe(insertTo('target', { id: 1 }, 'inside', 'slot'));
  pipeline.all();
  check(
    'insertTo overwritePolicy skip keeps target and reports zero inserts',
    data.target.slot.id === 99 &&
      pipeline.getStats().inserted === 0 &&
      pipeline.getStats().warnings.some((warning) => warning.includes('target.slot')),
  );
}

{
  const data = {
    tree: { kind: 'source', children: [{ kind: 'target' }] },
    untouched: true,
  };
  const pipeline = new JsnqPipeline(data).pipe(where('kind', '===', 'source'), moveTo('tree.children'));
  let threw = false;
  try {
    pipeline.all();
  } catch {
    threw = true;
  }
  check(
    'moveTo rejects moving a node into its own descendant without mutating the tree',
    threw && data.tree.children.length === 1 && data.tree.children[0].kind === 'target' && pipeline.getStats().moved === 0,
  );
}

{
  const data = { kind: 'source', target: [] as unknown[] };
  const pipeline = new JsnqPipeline(data).pipe(where('kind', '===', 'source'), moveTo('target'));
  let threw = false;
  try {
    pipeline.all();
  } catch {
    threw = true;
  }
  check('moveTo rejects a root source instead of duplicating it', threw && data.target.length === 0 && pipeline.getStats().moved === 0);
}

{
  const data = { target: 42 };
  const pipeline = new JsnqPipeline(data).pipe(insertTo('target', { id: 1 }));
  let threw = false;
  try {
    pipeline.all();
  } catch {
    threw = true;
  }
  check('insertTo rejects a primitive target without false stats', threw && data.target === 42 && pipeline.getStats().inserted === 0);
}

{
  const data = {
    source: [{ kind: 'source', value: 1 }],
    target: [] as Array<{ kind: string; value: number }>,
  };
  const pipeline = new JsnqPipeline(data)
    .pipe(where('kind', '===', 'source'), moveToMatches('length', '===', 0));
  pipeline.all();
  check(
    'keyless moveToMatches treats an array target as an array and pushes the source',
    data.source.length === 0 && data.target.length === 1 && data.target[0].value === 1 && pipeline.getStats().moved === 1,
  );
}

{
  const data = { target: { kind: 'target', stable: true } as Record<string, unknown> };
  const pipeline = new JsnqPipeline(data).pipe(where('kind', '===', 'target'), insert([1, 2], 'inside'));
  pipeline.all();
  check(
    'keyless array payload is not merged into an object as numeric properties',
    !('0' in data.target) && !('1' in data.target) && data.target.stable === true &&
      pipeline.getStats().inserted === 0 && pipeline.getStats().warnings.length > 0,
  );
}

{
  const data = { target: { kind: 'target', children: [] as Array<{ kind: string; children: unknown[] }> } };
  const pipeline = new JsnqPipeline(data)
    .pipe(where('kind', '===', 'target'), insert({ kind: 'target', children: [] }, 'inside', 'children'));
  pipeline.all();
  check(
    'insert uses a stable match set and does not recursively re-match its inserted node',
    data.target.children.length === 1 && pipeline.getStats().inserted === 1,
  );
}

{
  const first = { id: 1 };
  const second = { id: 2 };
  const parent = { first, second };
  const removed = removeFromOriginal({ data: second, parent, parentKey: 'first', depth: 1 });
  check(
    'removeFromOriginal never deletes a stale object key that points at another value',
    removed === false && parent.first === first && parent.second === second,
  );
}

{
  const data = {
    source: [{ kind: 'source', targets: [{ kind: 'target' }] }],
  };
  const pipeline = new JsnqPipeline(data)
    .pipe(where('kind', '===', 'source'), moveToMatches('kind', '===', 'target'));
  pipeline.all();
  check(
    'moveToMatches skips descendant targets and preserves the source',
    data.source.length === 1 && data.source[0].targets.length === 1 && pipeline.getStats().moved === 0,
  );
}

{
  const data = [{
    kind: 'row',
    config: {
      items: [{ id: 1, left: true }, { label: 'a' }, { label: 'b' }, { id: 2 }, { id: 2 }],
    },
  }];
  new JsnqPipeline(data, { arrayMergeStrategy: 'merge-by-key' })
    .pipe(where('kind', '===', 'row'), mergeUpdate('config', {
      items: [{ id: 1, right: true }, { label: 'c' }, { label: 'd' }, { id: 2 }, { id: 2 }],
    }, { deep: true }))
    .all();
  const items = data[0].config.items;
  const merged = items.find((item) => item.id === 1);
  check(
    'merge-by-key merges unique keys without dropping missing or duplicate keys',
    items.length === 9 && merged?.left === true && merged?.right === true &&
      items.filter((item) => item.id === undefined).length === 4 &&
      items.filter((item) => item.id === 2).length === 4,
  );
}

{
  const data: {
    source: Array<{ kind: string; id: number }>;
    target: undefined;
  } = { source: [{ kind: 'source', id: 1 }], target: undefined };
  let threw = false;
  try {
    new JsnqPipeline(data).pipe(where('kind', '===', 'source'), moveTo('target.items')).all();
  } catch {
    threw = true;
  }
  check(
    'path creation preserves an explicitly undefined owner',
    threw && data.target === undefined && data.source.length === 1,
  );
}

{
  const data = { source: [{ kind: 'source', id: 1 }], target: 42 };
  const pipeline = new JsnqPipeline(data).pipe(where('kind', '===', 'source'), copyTo('target'));
  let threw = false;
  try {
    pipeline.all();
  } catch {
    threw = true;
  }
  check(
    'copyTo rejects a non-insertable target without false copied stats',
    threw && data.source.length === 1 && data.target === 42 && pipeline.getStats().copied === 0,
  );
}

{
  const data = {
    source: [{ kind: 'source', value: 1 }],
    target: { kind: 'target' } as Record<string, unknown>,
  };
  const pipeline = new JsnqPipeline(data, { dryRun: true })
    .pipe(where('kind', '===', 'source'), moveToMatches('kind', '===', 'target'));
  pipeline.all();
  check(
    'fan-out dryRun counts only insertable plans and leaves data untouched',
    pipeline.getStats().moved === 0 && data.source.length === 1 && !('value' in data.target),
  );
}

{
  const data = {
    tree: {
      fields: [
        { id: 'group-a', fields: [{ id: 'leaf', fields: [] as unknown[] }] },
        { id: 'group-b', fields: [] as Array<{ id: string; fields: unknown[] }> },
      ],
    },
  };
  new JsnqPipeline(data)
    .pipe(where('fields@id', '===', 'leaf'), moveTo('tree.fields.1.fields'))
    .all();
  check(
    'deep fields@id moves one nested node without loss or duplicate',
    data.tree.fields[0].fields.length === 0 &&
      data.tree.fields[1].fields.length === 1 &&
      data.tree.fields[1].fields[0]?.id === 'leaf',
  );
}

{
  const data = {
    source: [1, 2, 3].map((id) => ({ kind: 'source', id })),
    target: { kind: 'target', items: [] as Array<{ kind: string; id: number }> },
  };
  new JsnqPipeline(data)
    .pipe(where('kind', '===', 'source'), moveToMatches('kind', '===', 'target', 'inside', 'items'))
    .all();
  check('moveToMatches preserves source order', data.target.items.map((item) => item.id).join(',') === '1,2,3');
}

{
  const data = {
    sources: [
      { id: 'a', kind: 'source', value: 1 },
      { id: 'b', kind: 'source', value: 2 },
    ],
    target: { kind: 'target' },
  };
  const pipeline = new JsnqPipeline(data, { overwritePolicy: 'skip' })
    .pipe(where('kind', '===', 'source'), moveToMatches('kind', '===', 'target', 'inside', 'slot'));
  pipeline.all();
  check(
    'fan-out skip reserves an object slot and preserves the colliding source',
    data.target.slot.id === 'a' && data.sources.length === 1 && data.sources[0].id === 'b' && pipeline.getStats().moved === 1,
  );
}

{
  const data = {
    sources: [
      { id: 'a', kind: 'source' },
      { id: 'b', kind: 'source' },
    ],
    target: { kind: 'target' },
  };
  const before = JSON.stringify(data);
  let threw = false;
  try {
    new JsnqPipeline(data, { overwritePolicy: 'error' })
      .pipe(where('kind', '===', 'source'), moveToMatches('kind', '===', 'target', 'inside', 'slot'))
      .all();
  } catch {
    threw = true;
  }
  check('fan-out error detects planned object-slot collisions before removal', threw && JSON.stringify(data) === before);
}

{
  const data = {
    source: [{ kind: 'source', nested: { value: 1 } }],
    targets: [
      { kind: 'target', items: [] as Array<{ kind: string; nested: { value: number } }> },
      { kind: 'target', items: [] as Array<{ kind: string; nested: { value: number } }> },
    ],
  };
  new JsnqPipeline(data)
    .pipe(where('kind', '===', 'source'), copyToAll('kind', '===', 'target', 'inside', 'items'))
    .all();
  const first = data.targets[0].items[0];
  const second = data.targets[1].items[0];
  check('copyToAll creates independent target values', first !== second && first.nested !== second.nested);
}

{
  const data = {
    source: [{ kind: 'source', id: 1, nested: { value: 1 } }],
    targets: [
      { kind: 'target', items: [] as Array<{ kind: string; id: number; nested: { value: number } }> },
      { kind: 'target', items: [] as Array<{ kind: string; id: number; nested: { value: number } }> },
    ],
  };
  new JsnqPipeline(data)
    .pipe(where('kind', '===', 'source'), moveToAll('kind', '===', 'target', 'inside', 'items'))
    .all();
  const first = data.targets[0].items[0];
  const second = data.targets[1].items[0];
  check(
    'moveToAll removes the source and isolates mutable targets',
    data.source.length === 0 && first !== second && first.nested !== second.nested,
  );
}

{
  const data = {
    source: [{ kind: 'source', value: 1 }],
    target: { kind: 'target' } as Record<string, unknown>,
  };
  const pipeline = new JsnqPipeline(data)
    .pipe(where('kind', '===', 'source'), moveToMatches('kind', '===', 'target'));
  pipeline.all();
  check(
    'keyless moveToMatches into an object keeps the source instead of merging it',
    data.source.length === 1 && !('value' in data.target) && pipeline.getStats().warnings.length > 0,
  );
}

{
  const data = {
    source: [{ kind: 'source', id: 1 }],
    target: { items: [{ kind: 'existing', id: 0 }] },
  };
  new JsnqPipeline(data).pipe(where('kind', '===', 'source'), moveTo('target', 'inside', 'items')).all();
  check(
    'moveTo appends when an object key already contains an array',
    Array.isArray(data.target.items) && data.target.items.map((item) => item.id).join(',') === '0,1',
  );
}

if (failed > 0) {
  console.error(`\n${failed} structural safety test(s) failed; ${passed} passed.`);
  process.exit(1);
}

console.log(`\nAll ${passed} JSNQ structural safety tests passed.`);
