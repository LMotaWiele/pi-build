import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { readSmartRouterTier } from "../lib/telemetry.ts";

test("readSmartRouterTier copies the latest dataset tier and is null when the file is absent", () => {
  const missing = fs.mkdtempSync(path.join(os.tmpdir(), "pi-router-tier-missing-"));
  assert.equal(readSmartRouterTier(missing), null);

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-router-tier-"));
  const state = path.join(dir, ".pi-smart-router");
  fs.mkdirSync(state);
  const db = new DatabaseSync(path.join(state, "state.db"));
  db.exec("CREATE TABLE dataset (id INTEGER PRIMARY KEY AUTOINCREMENT, tier TEXT NOT NULL)");
  db.prepare("INSERT INTO dataset (tier) VALUES (?)").run("economical-cloud");
  db.prepare("INSERT INTO dataset (tier) VALUES (?)").run("frontier-cloud");
  db.close();

  assert.equal(readSmartRouterTier(dir), "frontier-cloud");
});
