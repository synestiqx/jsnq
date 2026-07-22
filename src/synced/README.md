# jsnq

Krótkie wprowadzenie do `JsnqPipeline<TData>`, ścieżek, akcji i rejestrowania własnych operatorów porównań.

## Instalacja / import

```ts
import { JsnqPipeline, where, update, insert, deleteKey, deleteElement, moveTo, insertTo, moveToMatches, copyTo, registerOperator } from './jsnq';
```

## Typowanie danych: JsnqPipeline<TData>

Możesz typować dane wejściowe, aby zyskać lepsze podpowiedzi oraz bezpieczeństwo typów.

```ts
type MyData = {
  users: Array<{ id: number; name: string; profile?: { age?: number } }>;
};

const data: MyData = {
  users: [ { id: 1, name: 'Alice' }, { id: 2, name: 'Bob' } ]
};

const p = new JsnqPipeline<MyData>(data)
  .pipe(
    where('users[0].name', '===', 'Alice'),
    update('users[0].profile.age', (current) => (typeof current === 'number' ? current + 1 : 30))
  );

p.all();
```

## Składnia ścieżek

Silnik obsługuje jednocześnie:
- Notację kropkową: `profile.age`, `settings.logs`
- Indeksy w tablicach (nawiasy kwadratowe): `users[0].name`, `catalog.items[2]`

Wewnętrznie ścieżki są parsowane do segmentów, a brakujące gałęzie są tworzone automatycznie jako obiekty lub tablice (gdy następny segment jest indeksem numerycznym).

## Akcje (operators)

Przykłady:

```ts
new JsnqPipeline(data)
  .pipe(
    where('name', 'regex', '^A'),
    insert({ meta: {} }, 'inside'),
    update('meta.note', 'added'),
    moveTo('archive.items', 'inside'),
    deleteKey('temp')
  )
  .all();
```

Semantyka celów dla operatorów `*Matches`:
- `moveToMatches` / `copyToMatches`: przenoszą/kopiują do PIERWSZEGO dopasowanego celu. Liczba źródeł zależy od `.first()` (1) lub `.all()` (wszystkie dopasowane źródła).
- `moveToAll` / `copyToAll`: przenoszą/kopiują do WSZYSTKICH dopasowanych celów. Źródła również wg `.first()`/`.all()`.

Dostępne operatory: `where`, `update`, `replace`, `mergeUpdate`, `deleteKey`, `deleteElement`, `insert`, `moveTo`, `insertTo`, `moveToMatches`, `moveToMatchesOverwrite`, `copyTo`, `copyToMatches`, `moveToAll`, `copyToAll`.

Nowe operatory porównania: `isArray`, `isObject` (opcjonalny argument boolean wskazuje oczekiwaną wartość). Są typowane – nie trzeba używać `as any`.
Przykład:

```ts
// sprawdź czy pole jest tablicą, bez rzutowań
where('items', 'isArray', true);
// sprawdź czy pole jest obiektem
where('meta', 'isObject', true);
```
Operatory modyfikacji: `update(path, value)` zastępuje wartość; `replace(path, value)` jest jawnym aliasem tej semantyki; `mergeUpdate(path, patch)` scala obiekty.

## Rejestrowanie własnych operatorów porównań

Możesz dodać własny operator (np. `isEven`) i użyć go w `where()`:

```ts
import { registerOperator, JsnqPipeline, where } from './jsnq';

registerOperator('isEven', (actual) => typeof actual === 'number' && actual % 2 === 0);

const data = { values: [1, 2, 3, 4] };
new JsnqPipeline(data)
  .pipe(where('values[1]', 'isEven', undefined))
  .all();
```

Operator jest rejestrowany globalnie dla bieżącego procesu i będzie dostępny dla wszystkich instancji `JsnqPipeline`.

## Wskazówki dotyczące wydajności

- Używaj `first()` z `earlyTermination`, jeśli potrzebujesz znaleźć tylko jeden wynik.
- Zawężaj kryteria `where(...)`, aby redukować liczbę odwiedzanych węzłów w DFS.

## Tryby immutable i dryRun

- Włącz niemutowalność explicite: `new JsnqPipeline(data, { immutable: true })` lub fluent: `new JsnqPipeline(data).immutable()`.
- Tryb `immutable: 'auto'` klonuje tylko, jeśli są akcje modyfikujące: `new JsnqPipeline(data, { immutable: 'auto' })` lub `new JsnqPipeline(data).immutable('auto')`.
- Podgląd bez modyfikacji: `new JsnqPipeline(data).dryRun()`; operacje i ostrzeżenia znajdziesz w `getStats()`.

## Ostrzeżenia ścieżek: `strictPathsWarn`

- Ustaw `strictPathsWarn: true`, aby otrzymywać ostrzeżenia w `stats.warnings` dla:
  - modyfikacji, które tworzą brakujące segmenty ścieżki (np. `replace`, `update`, `merge_update`, `insert_to`, `move`, `copy`),
  - prób usunięcia nieistniejącego klucza (`delete_key`).

Przykład:

```ts
import { JsnqPipeline, where, update, deleteKey, insertTo } from './jsnq';

const data = {};
const p = new JsnqPipeline(data, { strictPathsWarn: true })
  .pipe(
    update('a.b', 1),          // ostrzeżenie: ścieżka nie istniała
    insertTo('x.y', { z: 1 }), // ostrzeżenie: cel nie istniał
    where('a.b', '===', 1)
  );

p.all();
console.log(p.getStats().warnings);
// ["update: path 'a.b' did not exist; created implicitly", "insert_to: target path 'x.y' did not exist; created implicitly"]
```

## Statystyki

Po wywołaniu `.all()/.first()/.count()` możesz pobrać statystyki:

```ts
const stats = pipeline.getStats();
// { searchTime, nodesVisited, resultsFound, maxDepth }
```

## Uwagi

- `copy*` używa `structuredClone` jeśli dostępny, w przeciwnym razie fallback do `JSON.parse(JSON.stringify(...))`.
 - Wstawienia `inside|before|after` działają zarówno dla obiektów, jak i tablic; `insertTo` pozwala wskazać pozycję docelową bez potrzeby dopasowań.
 - Cele można wskazywać względnie (cechy węzłów) lub absolutnie prefiksem `$` (np. `$.baskets[0].items`).
 - Dla `inside` na tablicy możesz podać indeks jako `key` (liczba), aby wstawić na określonej pozycji: `insertTo('a.b', data, 'inside', 0)`, `moveTo('x.y', 'inside', 2)`.

## Zmiana (breaking): jawny `key` dla obiektów w `insertTo`/`moveTo`/`copyTo`

Od tej wersji w operacjach kierowanych na ścieżkę (`insertTo`, `moveTo`, `copyTo`) wymagany jest jawny, tekstowy `key` przy wstawianiu do obiektu, gdy:

- wstawiasz `inside` do obiektu (docelowy węzeł jest obiektem), lub
- wstawiasz `before`/`after` względem pola obiektowego (rodzic celu jest obiektem).

Wcześniej brakujący `key` skutkował automatycznie generowaną nazwą (`before_<key>`/`after_<key>` lub `insert_<ts>`). Teraz takie wywołanie rzuca błąd z komunikatem o wymogu podania `key`.

Powód: operacje na ścieżkę nie mają kontekstu nazwy źródłowego klucza, więc automatyczne nazwy bywały zaskakujące i mogły nadpisywać pola. Wymóg jawnego `key` czyni semantykę jednoznaczną i bezpieczniejszą.

Uwaga: dotyczy to tylko operacji na ścieżkę. Operatory fanout (`moveToMatches`/`copyToMatches`/`moveToAll`/`copyToAll`) działają względnie i domyślnie zachowują oryginalną nazwę klucza źródłowego przy wstawieniu do obiektu, o ile nie podasz własnego `key`.

### Przykłady po zmianie

```ts
import { JsnqPipeline, moveTo, insertTo, copyTo } from './jsnq';

const store = { basket: { items: {} }, catalog: { entry: { id: 1 } } };

// INSIDE do obiektu: wymagany jawny klucz
new JsnqPipeline(store)
  .pipe(copyTo('basket.items', 'inside', 'entry1'))
  .all();
// OK: basket.items.entry1 = <skopiowany element>

// BEFORE/AFTER względem obiektu: również wymagany jawny klucz
new JsnqPipeline(store)
  .pipe(moveTo('basket', 'after', 'movedEntry'))
  .all();
// OK: basket.movedEntry = <przeniesiony element>

// Próba bez klucza → wyjątek
new JsnqPipeline(store)
  .pipe(insertTo('basket.items', { a: 1 }, 'inside'))
  .all(); // Error: explicit string 'key' is required ...
```

### Typowanie klucza

- Dla ścieżek prowadzących do tablic `key` jest typu `number` (indeks) przy `inside`.
- Dla ścieżek prowadzących do obiektów `key` jest typu `string`.

Operatorom dodano przeciążenia, które egzekwują te reguły w czasie kompilacji:

```ts
// key musi być liczbą (tablica)
insertTo('baskets[0].items', { id: 1 }, 'inside', 0);

// key musi być stringiem (obiekt) — poprawnie
copyTo('basket.items', 'inside', 'entry_1');

// key musi być stringiem (obiekt) — to nie przejdzie w TS
// copyTo('basket.items', 'inside', 0);
```

## Ulepszony operator `regex`

- `where(..., 'regex', ...)` akceptuje teraz wartość typu `RegExp | string`.
- Dodatkowo wspiera notację łańcuchową `'/wzorzec/flagi'`, np. `'/^A/i'`.

## Ścisłość operatorów porównań: `operatorsStrict`

W `SearchOptions` możesz ustawić zachowanie dla nieznanych operatorów porównań:

- `operatorsStrict: 'warn'` — doda pojedyncze ostrzeżenie do `stats.warnings` (na operator),
- `operatorsStrict: 'throw'` — rzuci wyjątek z nazwą operatora,
- brak ustawienia — nieznany operator działa jak zawsze-false (z zachowaniem wstecznym).

Przykład:

```ts
new JsnqPipeline(data, { operatorsStrict: 'warn' })
  .pipe(where('id', 'nonexistent-op' as any, 1))
  .count();
// warnings: ["unknown comparison operator 'nonexistent-op'"]
```

## Typy ścieżek: wsparcie notacji nawiasowej

Oprócz dot-notacji dostępna jest typowa notacja nawiasowa w typach (np. `users[0].name`).

- Overloady operatorów (`where`, `update`, `deleteKey`, `moveTo`, `insertTo`, `copyTo`) akceptują teraz zarówno `Path<T>`, jak i `BracketPath<T>`.
- Uwaga: typowanie notacji nawiasowej w TS ma charakter przybliżony. Runtime jak dotąd wspiera w pełni `a[0].b`.

## Cache ścieżek (FIFO) i konfiguracja

Parser ścieżek (`splitPath`) używa ograniczonego cache z ewikcją FIFO o domyślnej wielkości 1000 wpisów. Możesz ją zmienić:

```ts
import { setPathCacheLimit } from './jsnq';
setPathCacheLimit(2000);
```

### Domyślne zachowanie klucza przy move/copy matches

- Jeśli przenosisz/kopiujesz dopasowanie, które pochodzi z wpisu obiektu (tj. jego `parentKey` jest stringiem), a cel jest obiektem i nie podasz `key`, to domyślnie zostanie zachowana oryginalna nazwa klucza.
  - Przykład: ze struktury `{ data: { a: { id: 1 } } }` dopasowanie `{ id: 1 }` pod kluczem `a`, po `moveToMatches(..., 'inside')` bez `key` da `target.a = { id: 1 }` (zamiast `insert_<ts>`).
  - Dla `before/after` z celem będącym obiektem (nowe pole na rodzicu celu) również użyty zostanie domyślnie klucz źródłowy, o ile nie podasz `key`.
- Kolizje: jeśli w obiekcie docelowym istnieje już taki klucz, zostanie nadpisany. Aby uniknąć nadpisania, podaj własny, unikalny `key`.
- Tablice: ta zasada nie dotyczy tablic. Dla `inside` na tablicy sens ma tylko liczbowy `key` (indeks). Stringowe `key` są ignorowane w kontekście tablic.

## Targety absolutne dla `*Matches`

W operatorach `moveToMatches/copyToMatches/...` można wskazać cele względem aktualnie odwiedzanego węzła (domyślnie), lub ścieżką absolutną od korzenia, używając prefiksu `$`:

```ts
// względnie (przykład selekcji tablicy przez cechę samej tablicy)
copyToMatches('length', '===', 0, 'inside');

// absolutnie do pojedynczego celu
copyToMatches('$.baskets[0].items', '===', true, 'inside'); // operator ignorowany; liczy się dopasowanie ścieżki
```

W trybie absolutnym jako cele wybrane zostają węzły, których ścieżka z korzenia odpowiada podanej ścieżce (prefiks `$`, np. `$.a.b[0].items`).

## Przykłady: inside z indeksem (tablica)

```ts
import { JsnqPipeline, insertTo, moveTo } from './jsnq';

const data = { items: [1, 2, 3] };

// Wstaw 999 na pozycję 1 (między 1 i 2)
new JsnqPipeline(data)
  .pipe(insertTo('items', 999, 'inside', 1))
  .all();
// data.items -> [1, 999, 2, 3]

// Przenieś dopasowany element na indeks 0 w docelowej tablicy
const store = { baskets: [{ items: [10, 20] }], catalog: { items: [{ id: 1 }, { id: 2 }] } };
new JsnqPipeline(store)
  .pipe(
    // wybierz element o id=2
    where('id', '===', 2),
    // przenieś na początek tablicy baskets[0].items
    moveTo('baskets[0].items', 'inside', 0)
  )
  .all();
// store.baskets[0].items -> [{id:2}, 10, 20]
```

Uwaga: liczbowy `key` działa tylko przy `inside` do tablic (wstawianie przez `splice`). Dla obiektów używaj stringowego `key`.

## Przykłady: mergeUpdate

```ts
import { JsnqPipeline, where, mergeUpdate } from './jsnq';

const data = { user: { name: 'Alice', meta: { rating: 4, info: { x: 1 } } } };

new JsnqPipeline(data)
  .pipe(
    where('name', '===', 'Alice'),
    mergeUpdate('meta', { badge: 'gold', rating: 10 })
  )
  .all();

// data.user.meta -> { rating: 10, badge: 'gold', info: { x: 1 } }
```

## .first() vs .all() oraz cele dla `*Matches`

Operatory `*Matches` różnią się zakresem celów:
- `moveToMatches` / `copyToMatches`: kierują do PIERWSZEGO dopasowanego celu.
- `moveToAll` / `copyToAll`: kierują do WSZYSTKICH dopasowanych celów.

`.first()` vs `.all()` steruje liczbą ŹRÓDEŁ (dopasowań po stronie wyszukiwania):
- `.first()` → użyj jednego, pierwszego źródła.
- `.all()` → użyj wszystkich dopasowanych źródeł.

Przykłady:

```ts
import { JsnqPipeline, where, moveToMatches, moveToAll } from './jsnq';

const data = {
  catalog: { items: [ {id: 1}, {id: 2} ] },
  baskets: [ { items: [] }, { items: [] } ]
};

// Wszystkie źródła (id=1 i id=2) → do PIERWSZEGO celu (np. baskets[0].items)
new JsnqPipeline(data)
  .pipe(where('id', '>=', 1), moveToMatches('items', 'isArray', true, 'inside'))
  .all();

// Tylko pierwsze źródło (id=1) → do WSZYSTKICH celów (baskets[*].items)
new JsnqPipeline(data)
  .pipe(where('id', '>=', 1), moveToAll('items', 'isArray', true, 'inside'))
  .first();
```

Przykład z targetem absolutnym (prefiks `$`):

```ts
import { JsnqPipeline, where, copyToMatches } from './jsnq';

const data = { catalog: { items: [{ id: 1 }] }, baskets: [{ items: [] }, { items: [] }] };

// Skopiuj dopasowany element TYLKO do jednego, absolutnie wskazanego celu
new JsnqPipeline(data)
  .pipe(
    where('id', '===', 1),
    copyToMatches('$.baskets[0].items', '===', true, 'inside')
  )
  .all();
// Tylko baskets[0].items otrzyma element; baskets[1].items pozostaje bez zmian
```

Analogicznie z `moveToAll` i absolutnym celem (cel i tak jest jeden):

```ts
import { JsnqPipeline, where, moveToAll } from './jsnq';

const data = { catalog: { items: [{ id: 2 }] }, baskets: [{ items: [] }, { items: [] }] };

new JsnqPipeline(data)
  .pipe(
    where('id', '===', 2),
    moveToAll('$.baskets[1].items', '===', true, 'inside')
  )
  .all();
// Element trafi do baskets[1].items; tryb "All targets" nie zmienia efektu, bo cel jest pojedynczy.
```

### Podsumowanie zachowania (źródła vs cele)

| Operator               | Źródła (.first/.all)       | Cele (targets)             | Przykład relatywny                         | Przykład absolutny                      |
|------------------------|----------------------------|----------------------------|--------------------------------------------|-----------------------------------------|
| moveToMatches          | 1 lub N (wg .first/.all)   | Pierwszy dopasowany cel    | `('length','===',0)` → pierwsza tablica   | `$.baskets[0].items`                    |
| copyToMatches          | 1 lub N (wg .first/.all)   | Pierwszy dopasowany cel    | `('length','===',0)` → pierwsza tablica   | `$.baskets[0].items`                    |
| moveToAll              | 1 lub N (wg .first/.all)   | Wszystkie dopasowane cele  | `('length','===',0)` → wszystkie tablice  | `$.baskets[1].items` (cel pojedynczy)   |
| copyToAll              | 1 lub N (wg .first/.all)   | Wszystkie dopasowane cele  | `('length','===',0)` → wszystkie tablice  | `$.baskets[1].items` (cel pojedynczy)   |

Uwagi:
- `.first()`/.`all()` wpływa na liczbę ŹRÓDEŁ (dopasowań). Dobór CELÓW zależy od operatora (`*Matches` → pierwszy; `*All` → wszystkie) i od typu targetu (relatywny kontra absolutny).
- Target absolutny (`$...`) zwykle wskazuje jeden węzeł, więc w `*All` i tak będzie pojedynczy cel.
