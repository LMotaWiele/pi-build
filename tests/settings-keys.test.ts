import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { unreadExampleKeys } from "../lib/settings-keys.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function collect(dir: string): string {
  let out = "";
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules") continue;
      out += collect(full);
    } else if (entry.name.endsWith(".ts")) out += `\n${fs.readFileSync(full, "utf8")}`;
  }
  return out;
}

test("every example.json key is a string literal under extensions or lib", () => {
  const example = JSON.parse(fs.readFileSync(path.join(root, "settings/hosts/example.json"), "utf8"));
  const sources = collect(path.join(root, "extensions")) + collect(path.join(root, "lib"));
  assert.deepEqual(unreadExampleKeys(example, sources), []);
});
