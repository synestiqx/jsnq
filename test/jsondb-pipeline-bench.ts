/**
 * jsondb-pipeline-bench.ts
 *
 * Focused micro-benchmark + correctness checks for the SYNCED JsonPipeline engine
 * (not the solid bridge). Covers every internal execution path so refactors can be
 * compared before/after:
 *  - search-only fast path (no actions, no paths)
 *  - flat-array fast path (where + update/merge/deleteKey on a flat array)
 *  - full DFS with actions on nested trees (update/replace)
 *  - deep `@` array search (fields@id)
 *  - move/copy matches fanout (moveToMatches / copyToAll)
 *  - insert relative + insertTo target path
 *  - dryRun + stats contract
 *
 * Run: bun test/jsondb-pipeline-bench.ts
 */

import { JsonPipeline } from '../src/synced';
import where from '../src/synced/operators/where';
import update from '../src/synced/operators/update';
import replace from '../src/synced/operators/replace';
import mergeUpdate from '../src/synced/operators/mergeUpdate';
import deleteKey from '../src/synced/operators/deleteKey';
import deleteElement from '../src/synced/operators/deleteElement';
import insert from '../src/synced/operators/insert';
import insertTo from '../src/synced/operators/insertTo';
import moveToMatches from '../src/synced/operators/moveToMatches';
import copyToAll from '../src/synced/operators/copyToAll';

type Case = {
  name: string;
  iterations: number;
  makeData: () => unknown;
  run: (data: unknown) => unknown;
  check: (data: unknown, out: unknown) => boolean;
};

function makeFlat(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    name: `User ${i}`,
    active: i % 2 === 0,
    score: (i * 37) % 100,
    meta: { group: i % 10, tags: ['a', 'b'] },
  }));
}

function makeNested(depth: number, breadth: number): Record<string, unknown> {
  const node = (d: number): Record<string, unknown> => {
    const out: Record<string, unknown> = { level: d, value: `v${d}`, score: d * 10 };
    if (d < depth) {
      for (let b = 0; b < breadth; b++) out[`child${b}`] = node(d + 1);
    }
    return out;
  };
  return node(0);
}

function makeCms(sections: number, fieldsPer: number, nestDepth: number) {
  const field = (id: string, d: number): Record<string, unknown> => ({
    id,
    type: d % 2 ? 'text' : 'group',
    label: `Field ${id}`,
    fields: d < nestDepth ? [field(`${id}-a`, d + 1), field(`${id}-b`, d + 1)] : [],
  });
  return {
    sections: Array.from({ length: sections }, (_, s) => ({
      id: `s${s}`,
      title: `Section ${s}`,
      fields: Array.from({ length: fieldsPer }, (_, f) => field(`f${s}-${f}`, 0)),
    })),
  };
}

const CASES: Case[] = [
  {
    name: 'search-only-flat-10000',
    iterations: 30,
    makeData: () => makeFlat(10000),
    run: (data) => new JsonPipeline(data as never, { returnPaths: false, buildMeta: false })
      .pipe(where('active', '===', true), where('score', '>', 50)).all(),
    check: (_d, out) => Array.isArray(out) && (out as unknown[]).length === 2400,
  },
  {
    name: 'flat-fastpath-where-update-10000',
    iterations: 30,
    makeData: () => makeFlat(10000),
    run: (data) => new JsonPipeline(data as never).pipe(where('active', '===', true), update('score', 1)).all(),
    check: (d) => (d as Array<{ score: number }>)[0].score === 1 && (d as Array<{ score: number }>)[1].score !== 1,
  },
  {
    name: 'flat-fastpath-merge+deleteKey-10000',
    iterations: 20,
    makeData: () => makeFlat(10000),
    run: (data) => new JsonPipeline(data as never)
      .pipe(where('active', '===', false), mergeUpdate('meta', { checked: true }), deleteKey('name')).all(),
    check: (d) => {
      const arr = d as Array<Record<string, unknown>>;
      return (arr[1].meta as Record<string, unknown>).checked === true && !('name' in arr[1]) && 'name' in arr[0];
    },
  },
  {
    name: 'nested-dfs-update-d7-b3',
    iterations: 200,
    makeData: () => makeNested(7, 3),
    run: (data) => new JsonPipeline(data as never).pipe(where('level', '===', 5), replace('value', 'X')).all(),
    check: (_d, out) => (out as unknown[]).length === 3 ** 5,
  },
  {
    name: 'deep-at-search-cms',
    iterations: 200,
    makeData: () => makeCms(10, 8, 3),
    run: (data) => new JsonPipeline(data as never).pipe(where('fields@type', '===', 'text')).all(),
    check: (_d, out) => (out as unknown[]).length > 0,
  },
  {
    name: 'deep-at-update-cms',
    iterations: 100,
    makeData: () => makeCms(10, 8, 3),
    run: (data) => new JsonPipeline(data as never)
      .pipe(where('fields@id', '===', 'f3-2-a-b'), update('label', 'Renamed')).all(),
    check: (_d, out) => (out as unknown[]).length === 1,
  },
  {
    name: 'move-to-matches-cms',
    iterations: 100,
    makeData: () => makeCms(6, 6, 2),
    run: (data) => new JsonPipeline(data as never)
      .pipe(where('id', '===', 'f0-0'), moveToMatches('id', '===', 's3'))
      .all(),
    check: (d) => {
      const root = d as { sections: Array<{ id: string; fields: Array<{ id: string }> }> };
      return !root.sections[0].fields.some((f) => f.id === 'f0-0');
    },
  },
  {
    name: 'copy-to-all-cms',
    iterations: 60,
    makeData: () => makeCms(6, 4, 1),
    run: (data) => new JsonPipeline(data as never)
      .pipe(where('id', '===', 'f1-1'), copyToAll('type', '===', 'group', 'inside', 'copied'))
      .all(),
    check: (d) => JSON.stringify(d).includes('"copied"'),
  },
  {
    name: 'insert-relative-after-flat-2000',
    iterations: 50,
    makeData: () => makeFlat(2000),
    run: (data) => new JsonPipeline(data as never)
      .pipe(where('id', '===', 1000), insert({ id: -1, name: 'inserted' }, 'after')).all(),
    check: (d) => (d as Array<{ id: number }>)[1001].id === -1,
  },
  {
    name: 'insert-to-path-nested',
    iterations: 300,
    makeData: () => {
      const d = makeNested(5, 3);
      ((d.child0 as Record<string, unknown>).child1 as Record<string, unknown>).items = [];
      return d;
    },
    run: (data) => new JsonPipeline(data as never)
      .pipe(insertTo('child0.child1.items', { fresh: true }, 'inside')).all(),
    check: (d) => {
      const items = ((d as Record<string, never>).child0 as Record<string, never>).child1['items'] as unknown[];
      return Array.isArray(items) && (items[0] as { fresh: boolean }).fresh === true;
    },
  },
  {
    name: 'dryRun-stats-flat-5000',
    iterations: 40,
    makeData: () => makeFlat(5000),
    run: (data) => {
      const p = new JsonPipeline(data as never).dryRun().pipe(where('active', '===', true), update('score', 999));
      const out = p.all();
      const stats = p.getStats();
      if (stats.updates !== 2500) throw new Error(`dryRun stats.updates=${stats.updates}`);
      return out;
    },
    check: (d) => (d as Array<{ score: number }>)[0].score !== 999,
  },
  {
    name: 'immutable-deep-update-d6-b3',
    iterations: 100,
    makeData: () => makeNested(6, 3),
    run: (data) => {
      const p = new JsonPipeline(data as never, { immutable: true }).pipe(where('level', '===', 4), update('value', 'IMM'));
      p.all();
      return p.data;
    },
    check: (d, out) => (d as Record<string, never>).child0['value'] !== 'IMM' && JSON.stringify(out).includes('IMM'),
  },
];

function fmt(n: number): string {
  return n.toFixed(4);
}

async function main() {
  console.log('=== jsondb synced pipeline micro-bench ===');
  let failures = 0;
  const rows: Array<{ name: string; avgMs: number; opsPerSec: number }> = [];

  for (const c of CASES) {
    // correctness once
    const data = c.makeData();
    const out = c.run(data);
    const ok = c.check(data, out);
    if (!ok) {
      failures++;
      console.error(`❌ CHECK FAIL ${c.name}`);
      continue;
    }
    // warmup
    for (let i = 0; i < 3; i++) c.run(c.makeData());
    // timed: data prep excluded per iteration
    const datasets = Array.from({ length: c.iterations }, () => c.makeData());
    const t0 = performance.now();
    for (let i = 0; i < c.iterations; i++) c.run(datasets[i]);
    const total = performance.now() - t0;
    const avg = total / c.iterations;
    rows.push({ name: c.name, avgMs: avg, opsPerSec: Math.round(1000 / avg) });
  }

  console.log('case\tavgMs\topsPerSec');
  for (const r of rows) console.log(`${r.name}\t${fmt(r.avgMs)}\t${r.opsPerSec}`);

  if (failures > 0) {
    console.error(`\n${failures} correctness check(s) FAILED`);
    process.exit(1);
  }
  console.log('\njsondb-pipeline-bench: all correctness checks passed.');
}

main();
