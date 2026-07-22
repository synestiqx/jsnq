/**
 * Path segments must never resolve to prototype objects.
 * Run: bun test/jsnq-prototype-guard.test.ts
 */
import { getJsonBySegments, readJsonPath, hasJsonPath } from '../src/data-engine';

let failures = 0;
const ok = (cond: unknown, msg: string) => {
  if (cond) console.log(`PASS ${msg}`);
  else { console.error(`FAIL ${msg}`); failures++; }
};

const obj: Record<string, unknown> = { user: { profile: { name: 'Ann' } }, items: [{ tag: 't' }] };

// The hole this test was written for: getJsonBySegments takes raw segments and therefore
// bypasses the plan compiler that rejects unsafe names on string paths.
for (const forbidden of ['__proto__', 'prototype', 'constructor']) {
  const value = getJsonBySegments(obj, [forbidden]);
  ok(value === undefined, `getJsonBySegments(['${forbidden}']) is undefined, not a prototype`);
  ok(value !== Object.prototype, `getJsonBySegments(['${forbidden}']) never returns Object.prototype`);
}
ok(getJsonBySegments(obj, ['user', '__proto__', 'name']) === undefined, 'a forbidden segment mid-path stops the walk');

// Ordinary keys must be unaffected, including ones whose length matches the pre-filter.
ok(getJsonBySegments(obj, ['user', 'profile', 'name']) === 'Ann', 'normal nested read still works');
ok(getJsonBySegments(obj, ['items', '0', 'tag']) === 't', 'array index read still works');
ok(getJsonBySegments({ reference: 'ok' }, ['reference']) === 'ok', '9-character ordinary key still resolves');
ok(getJsonBySegments({ constructors: 'ok' }, ['constructors']) === 'ok', '12-character lookalike key still resolves');

// String-path entry points reject unsafe names while compiling the plan.
for (const path of ['__proto__', 'user.__proto__', 'constructor']) {
  let threw = false;
  try { readJsonPath(obj, path); } catch { threw = true; }
  ok(threw, `readJsonPath('${path}') refuses the unsafe path`);
  threw = false;
  try { hasJsonPath(obj, path); } catch { threw = true; }
  ok(threw, `hasJsonPath('${path}') refuses the unsafe path`);
}

if (failures > 0) { console.error(`\n${failures} assertion(s) failed`); process.exit(1); }
console.log('\nAll prototype-guard tests passed.');
