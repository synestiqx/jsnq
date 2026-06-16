# @synestiqx/jsondb

Framework-agnostic **JSON pipeline engine**: filter (`where`), mutate (`update` /
`replace` / `mergeUpdate` / `deleteKey` / `deleteElement`) and restructure
(`insert` / `insertTo` / `moveTo` / `copyTo` / `moveToMatches` / `copyToAll` / …)
nested JSON trees. Copy-on-write fast paths for the common flat-array + value-action
shape. **Zero runtime dependencies.**

This package is the single source of truth shared (byte-identical) by the SolidJS
store (`@synestiqx/solidstore`) and the Angular SignalStore — consume it like any
other dependency (the way you'd depend on `rxjs`), not as a vendored copy.

## Install

```sh
bun add @synestiqx/jsondb     # or: npm i @synestiqx/jsondb
```

## Usage

```ts
import { JsonPipeline, where, update, moveTo } from '@synestiqx/jsondb';

const data = { users: [{ id: 1, name: 'Ann' }, { id: 2, name: 'Bob' }] };

// query
new JsonPipeline(data.users).pipe(where('id', '===', 1)).first();

// mutate in place (auto-clone available via .immutable())
new JsonPipeline(data.users).pipe(where('id', '===', 1), update('name', 'Ada')).all();
```

Deep imports are available for advanced/host integrations:

```ts
import { tryFastPipelineMutation, collectFlatValueActionPaths } from '@synestiqx/jsondb';
import { criteriaMatch } from '@synestiqx/jsondb/core/match';
import where from '@synestiqx/jsondb/operators/where';
```

## Scripts

```sh
bun test          # run the engine test suite (units, fastpath parity, data-engine, bench)
bun run typecheck # tsc --noEmit
bun run build     # emit dist/ (JS + .d.ts) for npm publishing
```

> Dev/test consumption resolves to the TypeScript sources (`src/`) so no build step
> is needed with bun/tsx. For an npm release, run `bun run build` and point the
> package `exports` at `dist/`.

## License

MIT
