# Add a required unit to every reading

The change is fully specified. Do not invent a second design. Each file is named once, by its path from the repository root.

## tests/fixtures/ab/src/types.ts

Add `unit: string` to `Reading`, after `value`. Leave `Batch` as a list of `Reading`.

## tests/fixtures/ab/src/parse.ts

A reading line is four whitespace-separated fields: `id label value unit`.

- Reject a line that does not have exactly four fields.
- `value` stays a finite number.
- `unit` is the fourth field, unchanged.
- `parseBatch` still splits on newlines, trims, and drops blank lines.

## tests/fixtures/ab/src/format.ts

`formatReading` returns `id label value unit`, separated by single spaces, with no extra fields.

## tests/fixtures/ab/src/store.ts

`describe` returns `` `${reading.label} [${reading.unit}]` ``. `emptyBatch` and `addReading` keep their current behaviour and pass `unit` through with the rest of the reading.

## tests/fixtures/ab/src/validate.ts

`validateReading` also rejects an empty or whitespace-only `unit` with the error `empty unit`. Keep the existing id, label, and value checks.

## tests/fixtures/ab/src/report.test.ts

Update the fixture text and the assertion so the gate passes:

- `TEXT` is `alpha temp 21.5 C\nbravo load 3 pct\n`
- `describe` of the first reading equals `temp [C]`

## Done

From `tests/fixtures/ab`, both of these exit 0:

```
./node_modules/.bin/tsc --noEmit
node --test
```
