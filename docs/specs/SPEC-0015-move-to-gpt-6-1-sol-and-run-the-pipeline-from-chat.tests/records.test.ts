import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const at = (p: string) => resolve(ROOT, p);
const row = (id: string) => readFileSync(at("docs/specs/index.md"), "utf8").split("\n").find((l) => l.startsWith(`| ${id} |`)) ?? "";

test("0011 and 0014 are recorded as implemented, by who built them", () => {
  assert.match(row("0011"), /\| implemented \| pi \|/);
  assert.match(row("0014"), /\| implemented \| pi pipeline \|/);
});

test("SPEC-0009's host-config test is superseded, and its landing says so", () => {
  const dir = readdirSync(at("docs/specs")).find((f) => f.startsWith("SPEC-0009-") && f.endsWith(".tests"));
  assert.ok(dir);
  assert.equal(existsSync(at(`docs/specs/${dir}/host-config.test.ts`)), false);
  const spec = readdirSync(at("docs/specs")).find((f) => f.startsWith("SPEC-0009-") && f.endsWith(".md") && !f.endsWith("-run.md"))!;
  const landing = readFileSync(at(`docs/specs/${spec}`), "utf8").split(/^## 11\. Landing/m)[1] ?? "";
  assert.match(landing, /host-config\.test\.ts/);
  assert.match(landing, /supersed/i);
});

test("pi is pinned at 0.99.1", () => {
  assert.match(readFileSync(at("deps.txt"), "utf8"), /^pi 0\.99\.1$/m);
  assert.match(readFileSync(at("install.sh"), "utf8"), /PI_VERSION="\$\{PI_VERSION:-0\.99\.1\}"/);
  assert.doesNotMatch(readFileSync(at("README.md"), "utf8"), /0\.87\.1/);
});
