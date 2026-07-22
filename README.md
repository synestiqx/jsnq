# jsnq

Framework-independent JSON query and mutation engine used by SolidStore and Angular SignalStore. It supports flat arrays and deeply nested trees, copy-on-write host mutations, typed paths, structural moves/copies, and focused operator imports. It has no runtime dependencies.

## Install

```sh
npm install jsnq
# or
bun add jsnq
```

Installing straight from Git also works, because the repository commits its build output:

```sh
bun add github:synestiqx/jsnq
```

The package ships tree-shakeable ESM, a CommonJS fallback, and declarations. Modern
bundlers select `import`, Node `require()` selects the isolated CommonJS build, and both
share one TypeScript source.

## Query And Mutate

```ts
import JsnqPipeline from 'jsnq/core/pipeline';
import where from 'jsnq/operators/where';
import update from 'jsnq/operators/update';

const users = [
  { id: 1, profile: { name: 'Ann' }, active: true },
  { id: 2, profile: { name: 'Bob' }, active: false },
];

const query = new JsnqPipeline(users).pipe(where('active', '===', true));
const first = query.first();

const mutation = new JsnqPipeline(users, { immutable: true })
  .pipe(where('id', '===', 2), update('profile.name', 'Ada'));
mutation.all();
const nextUsers = mutation.data;
```

`pipe()` composes immutable operator descriptors. Execution is explicit:

- `all()` returns every matching result node;
- `first()` returns the first matched value or `null`;
- `count()` returns the number of matches;
- `getStats()` reports traversal, action counts, timings, warnings, and operations;
- `dryRun()` plans and measures without mutating;
- `immutable(true)` always clones before actions, while `immutable('auto')` clones only
  when the pipeline contains a mutation.

Structural operators are independent modules:

```ts
import moveTo from 'jsnq/operators/moveTo';
import copyToAll from 'jsnq/operators/copyToAll';
import insertTo from 'jsnq/operators/insertTo';
```

## Operator Reference

| Operator | Purpose |
| --- | --- |
| `where(path, operator, value)` | Add an AND-combined criterion. |
| `update(path, valueOrFn)` | Update a matched value, creating a missing path when policy allows it. |
| `replace(path, valueOrFn)` | Replace a matched value. |
| `mergeUpdate(path, patch, { deep })` | Shallow or deep merge into a matched object. |
| `deleteKey(path)` | Delete a key/index from each match. |
| `deleteElement()` | Remove each matched element from its parent container. |
| `insert(data, mode, key)` | Insert relative to each match. |
| `insertTo(path, data, mode, key)` | Insert into a target path. |
| `moveTo` / `copyTo` | Move or copy matches to one path. |
| `moveToMatches` / `copyToMatches` | Move or copy matched sources to the first selected target. |
| `moveToAll` / `copyToAll` | Move or copy matched sources into every selected target. |
| `moveToMatchesOverwrite` | Move matches and overwrite a selected target key. |

Insertion modes are `inside`, `before`, and `after`. Built-in comparisons are `==`,
`===`, `!=`, `!==`, `>`, `>=`, `<`, `<=`, `includes`, `!includes`, `startsWith`,
`endsWith`, `regex`, `isArray`, and `isObject`. Multiple `where()` calls are AND-combined.
Deep `@` criteria and nested object/array paths use the general traversal; supported flat
shapes select copy-on-write fast paths automatically.

Structural operations use a stable match set: nodes inserted by `moveTo` or `copyTo` are
not visited again by the same operation. Multi-source moves preserve source order after
safe descending-index removal. Multi-target move/copy results do not share mutable object
references between targets. When an explicit object key already contains an array,
`insertTo`, `moveTo`, and `copyTo` append to that array rather than replacing it. A
non-insertable target fails before source removal or success-stat updates.

`moveToMatches` and `copyToMatches` intentionally use only the first target in traversal
order. `moveToAll` and `copyToAll` use every target. In both forms, `.all()` supplies all
matched sources and `.first()` supplies one source. For object fan-out without an explicit
key, the source property name or its `id` is used. The default `overwritePolicy` is
`'overwrite'`; choose `'skip'` or `'error'` when replacing an existing object slot is not
acceptable.

Importing one operator does not execute or instantiate the others. A pipeline, compiled predicate, path plan, and mutation result are created only when the corresponding API is called. Path plans and compiled hot paths are cached with bounded caches.

## Data Engine

Hosts can use the same public path engine instead of duplicating traversal logic:

```ts
import {
  readJsonPath,
  writeJsonPath,
  deleteJsonPath,
  createJsonPathPlan,
} from 'jsnq/data-engine';

const state: Record<string, unknown> = {};
writeJsonPath(state, 'workspace.pages.0.title', 'Home');
readJsonPath(state, createJsonPathPlan('workspace.pages.0.title'));
deleteJsonPath(state, 'workspace.pages.0.title');
```

## Mutation Model

- Generic pipelines mutate their working data; `{ immutable: true }` clones before mutation.
- Host fast paths use copy-on-write: a new outer container and changed item are created while untouched branches retain identity.
- Single-key flat mutations shallow-clone the changed item and preserve untouched nested references.
- Structural operations fall back to the full traversal whenever the optimized path cannot prove semantic parity.
- No-match immutable fast paths retain the original root identity.
- `merge-by-key` merges values only when the configured key is present and unique on both
  sides. Missing or duplicate keys are preserved as separate entries instead of being
  collapsed by an ambiguous match.

Important pipeline options include `maxDepth`, `limit`, `earlyTermination`,
`includeArrays`, `includeObjects`, `returnPaths`, `strictPathsWarn`,
`operatorsStrict`, `overwritePolicy`, `arrayMergeStrategy`, and `trackOperations`.
`maxDepth` defaults to `10`; raise it explicitly for deeper recursive documents.
`overwritePolicy` governs object/path assignments, while insertion into an existing array
is an append/splice operation and does not replace that array key.
Optimized execution is an internal decision: unsupported or ambiguous shapes fall back to
the full pipeline with the same public semantics.

For production hosts that only commit the returned value, set `returnPaths: false` and
`trackOperations: false`. This avoids diagnostic path arrays and per-match log strings;
store bridges do this automatically outside development diagnostics. Benchmark output
separates complete batches, records scanned, and applied actions: a batch that scans 10,000
records is one batch, not one primitive operation.

## Package Boundaries

- `jsnq`: complete public API.
- `jsnq/operators/<name>`: one operator.
- `jsnq/core/<module>`: host and advanced integration.
- `jsnq/data-engine`: path read/write/delete and mutation metadata.

## Verify

```sh
bun run typecheck
bun test
bun run build
npm pack --dry-run
```

The suite covers nested paths, missing keys, special JavaScript values, immutable result identity, structural operations, fast-path parity, and native-equivalent behavior.

## Bundle Size

Measured from the built ESM with esbuild minification:

| Entry | Minified | Gzip | Brotli |
| --- | ---: | ---: | ---: |
| Full JSNQ entry | 53.9 kB | 16.1 kB | 14.5 kB |
| Individual `where` operator | 3.1 kB | 1.3 kB | 1.2 kB |

Import individual operators when an application does not need the full public surface.

## License

MIT
