/**
 * jsnq-pipeline-bench.ts
 *
 * Focused micro-benchmark + correctness checks for the SYNCED JsnqPipeline engine
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
 * Run: bun test/jsnq-pipeline-bench.ts
 */

import { JsnqPipeline, tryFastPipelineMutation } from '../src/synced';
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
import moveTo from '../src/synced/operators/moveTo';
import copyTo from '../src/synced/operators/copyTo';

const PRODUCTION_OPTIONS = {
  buildMeta: false,
  returnPaths: false,
  trackOperations: false,
} as const;

function productionPipeline(data: unknown, options: Record<string, unknown> = {}): JsnqPipeline {
  return new JsnqPipeline(data as never, { ...PRODUCTION_OPTIONS, ...options });
}

type Case = {
  name: string;
  iterations: number;
  /** Domain records intentionally processed by one full benchmark batch. */
  logicalItems: number;
  /** Expected mutation/action applications in one full batch (0 for reads). */
  actionApplications: number;
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
    logicalItems: 10000,
    actionApplications: 0,
    makeData: () => makeFlat(10000),
    run: (data) => productionPipeline(data)
      .pipe(where('active', '===', true), where('score', '>', 50)).all(),
    check: (_d, out) => Array.isArray(out) && (out as unknown[]).length === 2400,
  },
  {
    name: 'flat-fastpath-where-update-10000',
    iterations: 30,
    logicalItems: 10000,
    actionApplications: 5000,
    makeData: () => makeFlat(10000),
    run: (data) => productionPipeline(data).pipe(where('active', '===', true), update('score', 1)).all(),
    check: (d) => (d as Array<{ score: number }>)[0].score === 1 && (d as Array<{ score: number }>)[1].score !== 1,
  },
  {
    name: 'diagnostic-paths+operation-log-update-10000',
    iterations: 15,
    logicalItems: 10000,
    actionApplications: 5000,
    makeData: () => makeFlat(10000),
    run: (data) => new JsnqPipeline(data as never)
      .pipe(where('active', '===', true), update('score', 1)).all(),
    check: (d) => (d as Array<{ score: number }>)[0].score === 1 && (d as Array<{ score: number }>)[1].score !== 1,
  },
  {
    name: 'host-cow-commit-only-update-10000',
    iterations: 50,
    logicalItems: 10000,
    actionApplications: 5000,
    makeData: () => makeFlat(10000),
    run: (data) => tryFastPipelineMutation(
      data,
      [where('active', '===', true), update('score', 1)],
      { collectAffectedPaths: false },
    ),
    check: (d, out) => {
      const result = out as { value?: Array<{ score: number }>; matched?: number } | undefined;
      return result?.value?.[0].score === 1 && (d as Array<{ score: number }>)[0].score !== 1 && result.matched === 5000;
    },
  },
  {
    name: 'flat-fastpath-where-replace-10000',
    iterations: 30,
    logicalItems: 10000,
    actionApplications: 5000,
    makeData: () => makeFlat(10000),
    run: (data) => productionPipeline(data).pipe(where('active', '===', true), replace('score', 7)).all(),
    check: (d) => (d as Array<{ score: number }>)[0].score === 7 && (d as Array<{ score: number }>)[1].score !== 7,
  },
  {
    name: 'flat-fastpath-where-merge-10000',
    iterations: 20,
    logicalItems: 10000,
    actionApplications: 5000,
    makeData: () => makeFlat(10000),
    run: (data) => productionPipeline(data)
      .pipe(where('active', '===', false), mergeUpdate('meta', { checked: true })).all(),
    check: (d) => (d as Array<{ meta: { checked?: boolean } }>)[1].meta.checked === true,
  },
  {
    name: 'flat-fastpath-where-deleteKey-10000',
    iterations: 20,
    logicalItems: 10000,
    actionApplications: 5000,
    makeData: () => makeFlat(10000),
    run: (data) => productionPipeline(data)
      .pipe(where('active', '===', false), deleteKey('name')).all(),
    check: (d) => !('name' in (d as Array<Record<string, unknown>>)[1]) && 'name' in (d as Array<Record<string, unknown>>)[0],
  },
  {
    name: 'flat-fastpath-where-deleteElement-10000',
    iterations: 20,
    logicalItems: 10000,
    actionApplications: 5000,
    makeData: () => makeFlat(10000),
    run: (data) => productionPipeline(data)
      .pipe(where('active', '===', false), deleteElement()).all(),
    check: (d) => (d as Array<{ active: boolean }>).length === 5000 && (d as Array<{ active: boolean }>).every((row) => row.active),
  },
  {
    name: 'flat-fastpath-merge+deleteKey-10000',
    iterations: 20,
    logicalItems: 10000,
    actionApplications: 10000,
    makeData: () => makeFlat(10000),
    run: (data) => productionPipeline(data)
      .pipe(where('active', '===', false), mergeUpdate('meta', { checked: true }), deleteKey('name')).all(),
    check: (d) => {
      const arr = d as Array<Record<string, unknown>>;
      return (arr[1].meta as Record<string, unknown>).checked === true && !('name' in arr[1]) && 'name' in arr[0];
    },
  },
  {
    name: 'nested-dfs-update-d7-b3',
    iterations: 200,
    logicalItems: 3280,
    actionApplications: 243,
    makeData: () => makeNested(7, 3),
    run: (data) => productionPipeline(data).pipe(where('level', '===', 5), replace('value', 'X')).all(),
    check: (_d, out) => (out as unknown[]).length === 3 ** 5,
  },
  {
    name: 'deep-at-search-cms',
    iterations: 200,
    logicalItems: 1200,
    actionApplications: 0,
    makeData: () => makeCms(10, 8, 3),
    run: (data) => productionPipeline(data).pipe(where('fields@type', '===', 'text')).all(),
    check: (_d, out) => (out as unknown[]).length > 0,
  },
  {
    name: 'deep-at-update-cms',
    iterations: 100,
    logicalItems: 1200,
    actionApplications: 1,
    makeData: () => makeCms(10, 8, 3),
    run: (data) => productionPipeline(data)
      .pipe(where('fields@id', '===', 'f3-2-a-b'), update('label', 'Renamed')).all(),
    check: (_d, out) => (out as unknown[]).length === 1,
  },
  {
    name: 'move-to-path-cms',
    iterations: 100,
    logicalItems: 252,
    actionApplications: 1,
    makeData: () => makeCms(6, 6, 2),
    run: (data) => productionPipeline(data)
      .pipe(where('id', '===', 'f0-0'), moveTo('sections.3.fields')).all(),
    check: (d) => {
      const root = d as { sections: Array<{ fields: Array<{ id: string }> }> };
      return !root.sections[0].fields.some((field) => field.id === 'f0-0') &&
        root.sections[3].fields.some((field) => field.id === 'f0-0');
    },
  },
  {
    name: 'copy-to-path-cms',
    iterations: 100,
    logicalItems: 252,
    actionApplications: 1,
    makeData: () => makeCms(6, 6, 2),
    run: (data) => productionPipeline(data)
      .pipe(where('id', '===', 'f0-0'), copyTo('sections.3.fields')).all(),
    check: (d) => {
      const root = d as { sections: Array<{ fields: Array<{ id: string }> }> };
      return root.sections[0].fields.some((field) => field.id === 'f0-0') &&
        root.sections[3].fields.filter((field) => field.id === 'f0-0').length === 1;
    },
  },
  {
    name: 'move-to-matches-cms',
    iterations: 100,
    logicalItems: 252,
    actionApplications: 1,
    makeData: () => makeCms(6, 6, 2),
    run: (data) => productionPipeline(data)
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
    logicalItems: 72,
    actionApplications: 24,
    makeData: () => makeCms(6, 4, 1),
    run: (data) => productionPipeline(data)
      .pipe(where('id', '===', 'f1-1'), copyToAll('type', '===', 'group', 'inside', 'copied'))
      .all(),
    check: (d) => JSON.stringify(d).includes('"copied"'),
  },
  {
    name: 'insert-root-array-o1',
    iterations: 1000,
    logicalItems: 1,
    actionApplications: 1,
    makeData: () => Array.from({ length: 50 }, (_, id) => ({ id })),
    run: (data) => productionPipeline(data).pipe(insert({ id: -1 }, 'inside')).all(),
    check: (d) => (d as Array<{ id: number }>).length === 51 && (d as Array<{ id: number }>)[50].id === -1,
  },
  {
    name: 'insert-relative-after-flat-2000',
    iterations: 50,
    logicalItems: 2000,
    actionApplications: 1,
    makeData: () => makeFlat(2000),
    run: (data) => productionPipeline(data)
      .pipe(where('id', '===', 1000), insert({ id: -1, name: 'inserted' }, 'after')).all(),
    check: (d) => (d as Array<{ id: number }>)[1001].id === -1,
  },
  {
    name: 'insert-to-path-nested',
    iterations: 300,
    logicalItems: 1,
    actionApplications: 1,
    makeData: () => {
      const d = makeNested(5, 3);
      ((d.child0 as Record<string, unknown>).child1 as Record<string, unknown>).items = [];
      return d;
    },
    run: (data) => productionPipeline(data)
      .pipe(insertTo('child0.child1.items', { fresh: true }, 'inside')).all(),
    check: (d) => {
      const items = ((d as Record<string, never>).child0 as Record<string, never>).child1['items'] as unknown[];
      return Array.isArray(items) && (items[0] as { fresh: boolean }).fresh === true;
    },
  },
  {
    name: 'dryRun-stats-flat-5000',
    iterations: 40,
    logicalItems: 5000,
    actionApplications: 2500,
    makeData: () => makeFlat(5000),
    run: (data) => {
      const p = productionPipeline(data).dryRun().pipe(where('active', '===', true), update('score', 999));
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
    logicalItems: 1093,
    actionApplications: 81,
    makeData: () => makeNested(6, 3),
    run: (data) => {
      const p = productionPipeline(data, { immutable: true }).pipe(where('level', '===', 4), update('value', 'IMM'));
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
  console.log('=== jsnq synced pipeline micro-bench ===');
  console.log('Primary rows use production settings: no result paths and no per-match operation strings.');
  console.log('One batch processes the logical item count shown by each case; batch/s is not primitive ops/s.');
  let failures = 0;
  const rows: Array<{
    name: string;
    avgMs: number;
    batchesPerSec: number;
    logicalItemsPerSec: number;
    actionsPerSec: number;
  }> = [];

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
    // Three samples; data preparation remains excluded from every timed window.
    const samples: number[] = [];
    for (let sample = 0; sample < 3; sample++) {
      const datasets = Array.from({ length: c.iterations }, () => c.makeData());
      const t0 = performance.now();
      for (let i = 0; i < c.iterations; i++) c.run(datasets[i]);
      samples.push((performance.now() - t0) / c.iterations);
    }
    samples.sort((a, b) => a - b);
    const avg = samples[1]!;
    const batchesPerSec = 1000 / avg;
    rows.push({
      name: c.name,
      avgMs: avg,
      batchesPerSec: Math.round(batchesPerSec),
      logicalItemsPerSec: Math.round(batchesPerSec * c.logicalItems),
      actionsPerSec: Math.round(batchesPerSec * c.actionApplications),
    });
  }

  console.log('case\tmedianMs\tbatches/s\tlogical-items/s\taction-applications/s');
  for (const r of rows) {
    console.log(`${r.name}\t${fmt(r.avgMs)}\t${r.batchesPerSec}\t${r.logicalItemsPerSec}\t${r.actionsPerSec}`);
  }

  if (failures > 0) {
    console.error(`\n${failures} correctness check(s) FAILED`);
    process.exit(1);
  }
  console.log('\njsnq-pipeline-bench: all correctness checks passed.');
}

main();
