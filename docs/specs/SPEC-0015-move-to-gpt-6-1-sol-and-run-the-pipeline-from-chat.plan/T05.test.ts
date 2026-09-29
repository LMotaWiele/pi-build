import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
test("installer defaults pi to 0.99.1 while retaining the override", () => {
  const install = readFileSync(resolve(import.meta.dirname, "../../../install.sh"), "utf8");
  assert.match(install, /PI_VERSION="\$\{PI_VERSION:-0\.99\.1\}"/);
  assert.doesNotMatch(install, /PI_VERSION="\$\{PI_VERSION:-0\.87\.1\}"/);
});
