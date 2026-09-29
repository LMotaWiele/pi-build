import { test } from "node:test";
import assert from "node:assert/strict";
import { double } from "../../../lib/smoke-double.ts";

test("double", () => {
  assert.equal(double(3), 6);
  assert.equal(double(0), 0);
  assert.equal(double(-4), -8);
});
