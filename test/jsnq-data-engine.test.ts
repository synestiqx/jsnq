import {
  JsonDataCursor,
  cloneJsonData,
  createMutationResult,
  createJsonPathPlan,
  deleteJsonPath,
  getJsonAffectedPaths,
  hasJsonPath,
  readJsonPath,
  splitJsonPath,
  writeJsonPath,
  writeJsonPathValue,
} from '../src/data-engine';

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

{
  const valueOnly = { nested: { items: [1, 2] as number[] } };
  const wrote = writeJsonPathValue(valueOnly, 'nested.items', [3, 4]);
  assert(wrote && valueOnly.nested.items.join(',') === '3,4', 'write-only path updates without a result allocation');
  assert(writeJsonPathValue(valueOnly, '', 1) === false, 'write-only path rejects root replacement');
}

const data: any = {
  users: [
    {
      id: 1,
      profile: {
        'display.name': 'Ada',
      },
    },
  ],
};

const shared = { value: 1 };
const cyclic: any = { list: [shared, shared], sparse: new Array(3), date: new Date(0) };
cyclic.self = cyclic;
const cloned = cloneJsonData(cyclic);
assert(cloned !== cyclic && cloned.list !== cyclic.list, 'clone creates independent records and arrays');
assert(cloned.list[0] === cloned.list[1] && cloned.list[0] !== shared, 'clone preserves shared nested references');
assert(cloned.self === cloned, 'clone preserves cycles for untyped JavaScript callers');
assert(!(0 in cloned.sparse) && cloned.sparse.length === 3, 'clone preserves sparse array holes');
assert(cloned.date instanceof Date && cloned.date.getTime() === 0, 'clone preserves host objects through fallback');

assert(JSON.stringify(splitJsonPath('users[0].profile["display.name"]')) === JSON.stringify(['users', '0', 'profile', 'display.name']), 'split quoted/bracket path');
assert(readJsonPath(data, 'users[0].profile["display.name"]') === 'Ada', 'read quoted/bracket path');

const writeResult = writeJsonPath(data, 'users.0.profile.stats.count', 1);
assert(readJsonPath(data, 'users.0.profile.stats.count') === 1, 'write creates nested path');
assert(hasJsonPath(data, 'users.0.profile.stats.count'), 'has path after write');
assert(writeResult.kind === 'set', `write result kind ${writeResult.kind}`);
assert(writeResult.next === 1, `write result next ${writeResult.next}`);
assert(writeResult.inserted.includes('users.0.profile.stats.count'), 'write result inserted path');
assert(writeResult.parents.includes('users.0.profile.stats'), 'write result parent path');
assert(writeResult.affectedPaths.length === 1 && writeResult.affectedPaths[0] === 'users.0.profile.stats.count', 'write result preserves exact affected path');

const plan = createJsonPathPlan('users.0.profile.stats.count');
assert(JSON.stringify(getJsonAffectedPaths(plan, 'branch')) === JSON.stringify([
  'users',
  'users.0',
  'users.0.profile',
  'users.0.profile.stats',
  'users.0.profile.stats.count',
]), 'branch affected paths');

const cursor = new JsonDataCursor();
const cursorResult = cursor.writeWithPlan(data, createJsonPathPlan('users.0.profile.stats.count'), 2);
assert(readJsonPath(data, 'users.0.profile.stats.count') === 2, 'cursor write uses plan');
assert(cursor.active, 'cursor active after write');
assert(cursorResult.kind === 'set' && cursorResult.previous === 1 && cursorResult.next === 2, 'cursor result exposes previous/next');

const deleteResult = deleteJsonPath(data, 'users.0.profile.stats.count');
assert(!hasJsonPath(data, 'users.0.profile.stats.count'), 'delete path');
assert(deleteResult.kind === 'delete', `delete result kind ${deleteResult.kind}`);
assert(deleteResult.previous === 2, `delete result previous ${deleteResult.previous}`);
assert(deleteResult.deleted.includes('users.0.profile.stats.count'), 'delete result deleted path');
assert(deleteResult.affectedPaths.includes('users.0.profile.stats'), 'delete result preserves branch affected paths');

const branchWrite = writeJsonPath(data, 'users.0.profile', { nested: { leaf: true } });
assert(branchWrite.branchReplaced, 'object write result marks branch replacement');

const synthetic = createMutationResult({
  path: 'users.0.profile.nested.leaf',
  kind: 'set',
  changed: ['users.0.profile.nested.leaf', 'users.0.profile.nested.leaf'],
});
assert(synthetic.parents.includes('users.0.profile.nested'), 'synthetic result derives parent paths');
assert(synthetic.affectedPaths.filter((path) => path === 'users.0.profile.nested.leaf').length === 1, 'synthetic result de-dupes affected paths');

console.log('All jsnq data-engine public import tests passed.');
