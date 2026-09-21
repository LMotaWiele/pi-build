/**
 * The notes-protocol skill is the README from "## Precedence" onward.
 * It names behaviour. It does not name a harness tool.
 */

import fs from "node:fs";
import path from "node:path";

export function renderSkill(readme: string): string {
  const start = readme.indexOf("## Precedence");
  if (start < 0) throw new Error("README.md has no ## Precedence");
  const body = readme.slice(start).replace(/\s*$/, "");
  return `---
name: notes-protocol
description: Project notes protocol. Read the index first, then exactly one linked note. Patch one field after a finding. Queue writes go to the index.
---

# Notes protocol

These are instructions. Read the index first, then exactly one linked note. Patch one front-matter field after a finding. Queue writes go to the index.

${body}
`;
}

function isDirectRun(): boolean {
  const entry = process.argv[1] ? path.resolve(process.argv[1]) : "";
  return entry.endsWith(`${path.sep}skill.ts`) || entry.endsWith(`${path.sep}skill.js`);
}

if (isDirectRun() && process.argv[2]) {
  process.stdout.write(renderSkill(fs.readFileSync(process.argv[2], "utf8")));
}
