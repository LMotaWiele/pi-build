import assert from "node:assert/strict";
import test from "node:test";
import { formatBatch } from "./format.ts";
import { parseBatch } from "./parse.ts";
import { addReading, describe, emptyBatch } from "./store.ts";
import type { Reading } from "./types.ts";
import { validateAll } from "./validate.ts";

const TEXT = "alpha temp 21.5\nbravo load 3\n";

test("readings round-trip through parse, store, validate, and format", () => {
  const readings = parseBatch(TEXT);
  assert.equal(`${formatBatch(readings)}\n`, TEXT);
  const batch = readings.reduce((acc, reading) => addReading(acc, reading), emptyBatch());
  assert.deepEqual(validateAll(batch.readings), []);
  const first: Reading = batch.readings[0];
  assert.equal(describe(first), "temp");
  assert.equal(batch.readings.length, 2);
});
