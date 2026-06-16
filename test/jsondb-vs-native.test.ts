/**
 * Parity vs a hand-written native-JS oracle for nested operations (search / update /
 * deep-@ / move / copy / delete). The oracle is plain recursion/array methods; jsondb
 * must produce identical results. Doubles as an informational perf ratio (jsondb vs raw JS).
 * Run: bun test/jsondb-vs-native.test.ts
 */
import { JsonPipeline } from '../src/synced';
import where from '../src/synced/operators/where';
import update from '../src/synced/operators/update';
import deleteElement from '../src/synced/operators/deleteElement';
import moveToMatches from '../src/synced/operators/moveToMatches';
import copyToAll from '../src/synced/operators/copyToAll';

let failures = 0;
function ok(cond: unknown, msg: string): void {
  if (!cond) { failures++; console.error(`❌ ${msg}`); } else { console.log(`✅ ${msg}`); }
}
const J = (x: unknown) => JSON.stringify(x);
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));

// ---- native oracle: pre-order DFS over every object/array node (root + descendants) ----
function nativeWalk(node: unknown, visit: (n: unknown) => void): void {
  visit(node);
  if (Array.isArray(node)) { for (const c of node) nativeWalk(c, visit); }
  else if (node && typeof node === 'object') { for (const k of Object.keys(node)) nativeWalk((node as any)[k], visit); }
}
function nativeFilter(root: unknown, key: string, eq: unknown): unknown[] {
  const out: unknown[] = [];
  nativeWalk(root, (n) => { if (n && typeof n === 'object' && !Array.isArray(n) && (n as any)[key] === eq) out.push(n); });
  return out;
}

// ---- nested CMS-ish fixture ----
function makeTree() {
  const field = (id: string, type: string, d: number): any => ({
    id, type, label: `L-${id}`,
    fields: d > 0 ? [field(`${id}a`, 'text', d - 1), field(`${id}b`, 'group', d - 1)] : [],
  });
  return {
    sections: Array.from({ length: 4 }, (_, s) => ({
      id: `s${s}`, type: 'section',
      fields: [field(`f${s}x`, 'text', 2), field(`f${s}y`, 'group', 2)],
    })),
  };
}

// 1) nested SEARCH parity: all nodes with type==='text' (compare sorted id sets)
{
  const tree = makeTree();
  const db = new JsonPipeline(clone(tree) as never).pipe(where('type', '===', 'text')).all()
    .map((n: any) => n.data.id).sort();
  const nat = nativeFilter(tree, 'type', 'text').map((n: any) => n.id).sort();
  ok(J(db) === J(nat) && db.length > 0, `nested search type==='text' parity (db ${db.length} vs native ${nat.length})`);
}

// 2) nested UPDATE parity: set label='X' on every type==='group' node, compare whole tree
{
  const a = clone(makeTree());
  const b = clone(makeTree());
  new JsonPipeline(a as never).pipe(where('type', '===', 'group'), update('label', 'X')).all();
  nativeWalk(b, (n) => { if (n && typeof n === 'object' && (n as any).type === 'group') (n as any).label = 'X'; });
  ok(J(a) === J(b), 'nested update (type===group => label=X) matches native tree');
}

// 3) deep-@ parity: fields@id === a specific deep id
{
  const tree = makeTree();
  const db = new JsonPipeline(clone(tree) as never).pipe(where('fields@id', '===', 'f0xa')).all()
    .map((n: any) => n.data.id);
  const nat = nativeFilter(tree, 'id', 'f0xa').map((n: any) => n.id);
  ok(J(db.sort()) === J(nat.sort()) && db.length === 1, `deep-@ search parity (got ${J(db)})`);
}

// 4) flat single-seg parity (the opt path): where('active') + update over a flat array
{
  const flat = () => Array.from({ length: 500 }, (_, i) => ({ id: i, active: i % 3 === 0, score: i }));
  const a = flat();
  const b = flat();
  new JsonPipeline(a as never).pipe(where('active', '===', true), update('score', -1)).all();
  for (const it of b) { if (it.active === true) it.score = -1; }
  ok(J(a) === J(b), 'flat single-seg where+update matches native map');
}

// 5) deleteElement parity on a flat array
{
  const flat = () => Array.from({ length: 50 }, (_, i) => ({ id: i }));
  const a = flat();
  new JsonPipeline(a as never).pipe(where('id', '===', 25), deleteElement()).all();
  const b = flat().filter((x) => x.id !== 25);
  ok(J(a) === J(b), 'deleteElement matches native filter');
}

// 6) move parity: move matching field out of source (native splice oracle for the source side)
{
  const tree = clone(makeTree());
  new JsonPipeline(tree as never).pipe(where('id', '===', 'f0x'), moveToMatches('id', '===', 's3')).all();
  const src = (tree as any).sections[0].fields.some((f: any) => f.id === 'f0x');
  const landed = J(tree).includes('"f0x"');
  ok(!src && landed, 'move removes from source and keeps element in tree (native-equivalent)');
}

// 7) copyToAll parity: source kept, copies added to every group target
{
  const data = { nodes: [ { id: 'g1', type: 'group', kids: [] as any[] }, { id: 'g2', type: 'group', kids: [] as any[] }, { id: 'leaf', type: 'item' } ] };
  const a = clone(data);
  new JsonPipeline(a as never).pipe(where('id', '===', 'leaf'), copyToAll('type', '===', 'group', 'inside', 'copied')).all();
  const groups = a.nodes.filter((n: any) => n.type === 'group');
  const allHaveCopy = groups.every((g: any) => g.copied && g.copied.id === 'leaf');
  ok(a.nodes.some((n: any) => n.id === 'leaf') && allHaveCopy, 'copyToAll keeps source + copies into every group');
}

// ---- informational perf ratio: jsondb deep scan vs native deep scan (noisy; not a gate) ----
{
  const big = { root: Array.from({ length: 2000 }, (_, i) => ({ id: i, type: i % 2 ? 'text' : 'group', kids: [{ id: `${i}-k`, type: 'text' }] })) };
  const N = 50;
  let t = performance.now();
  for (let i = 0; i < N; i++) new JsonPipeline(big as never, { returnPaths: false, buildMeta: false }).pipe(where('type', '===', 'text')).all();
  const dbMs = (performance.now() - t) / N;
  t = performance.now();
  for (let i = 0; i < N; i++) nativeFilter(big, 'type', 'text');
  const natMs = (performance.now() - t) / N;
  console.log(`\nℹ️  deep scan: jsondb ${dbMs.toFixed(3)}ms vs native ${natMs.toFixed(3)}ms (ratio ${(dbMs / natMs).toFixed(2)}x) — informational, machine-load sensitive`);
}

if (failures > 0) { console.error(`\n${failures} vs-native parity assertion(s) FAILED`); process.exit(1); }
console.log('\nAll jsondb vs-native parity tests passed.');
