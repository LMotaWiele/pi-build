#!/usr/bin/env node
// Convert one project's notes from schema v0 to v1.
// Writes INDEX.v1.md and <note>.v1.md beside the originals and prints a diff.
// Does not rename, and does not run as part of a session.

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const project = process.argv[2];
if (!project) {
  console.error("usage: node scripts/migrate-notes.js <project-root>");
  process.exit(2);
}

const runner = path.join(os.tmpdir(), `migrate-notes-${process.pid}.ts`);
const target = path.resolve(project);
const importer = path.join(root, "lib/scaffold.ts");
fs.writeFileSync(
  runner,
  `import { migrateProject } from ${JSON.stringify(importer)};\nprocess.exit(migrateProject(${JSON.stringify(target)}));\n`,
);
const result = spawnSync(process.execPath, ["--experimental-strip-types", runner], { stdio: "inherit" });
fs.unlinkSync(runner);
process.exit(result.status ?? 1);
