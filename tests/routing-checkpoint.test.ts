import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { appendQueue, parseIndex } from "../lib/markdown.ts";
import {
  checkpointOnBound,
  firstUnwrittenPath,
  runBoundAbort,
  uncertaintyDefaults,
} from "../extensions/routing.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("written files write one queue row; an empty list writes neither", async () => {
  const index = fs.readFileSync(path.join(root, ".agent/notes/INDEX.md"), "utf8");
  const before = parseIndex(index).activeNext.length;
  let next = index;
  const recaps: string[] = [];
  await checkpointOnBound({
    reason: "no-progress",
    written: ["src/a.ts"],
    resumeFrom: "src/b.ts",
    queueAppend: (item, source) => {
      next = appendQueue(next, item, source, "2026-09-22");
    },
    setRecap: (line) => recaps.push(line),
  });
  const rows = parseIndex(next).activeNext;
  assert.equal(rows.length, before + 1);
  assert.equal(rows.at(-1)?.item, "bounded at no-progress; wrote src/a.ts; resume from src/b.ts");
  assert.match(rows.at(-1)?.source ?? "", /§3\.1/);
  assert.deepEqual(recaps, [rows.at(-1)?.item]);

  let calls = 0;
  let recap = "";
  await checkpointOnBound({
    reason: "no-progress",
    written: [],
    resumeFrom: "(unknown)",
    queueAppend: () => {
      calls += 1;
    },
    setRecap: (line) => {
      recap = line;
    },
  });
  assert.equal(calls, 0);
  assert.equal(recap, "");
});

test("an empty written list still aborts and does not queue", async () => {
  let aborted = false;
  let calls = 0;
  await runBoundAbort({
    reason: "no-progress",
    written: [],
    resumeFrom: "(unknown)",
    queueAppend: () => {
      calls += 1;
    },
    setRecap: () => {
      calls += 1;
    },
    abort: () => {
      aborted = true;
    },
  });
  assert.equal(aborted, true);
  assert.equal(calls, 0);
});

test("a throwing queue_append still reaches abort", async () => {
  let aborted = false;
  await runBoundAbort({
    reason: "loop",
    written: ["src/a.ts"],
    resumeFrom: "src/b.ts",
    queueAppend: () => {
      throw new Error("boom");
    },
    setRecap: () => {
      throw new Error("recap");
    },
    abort: () => {
      aborted = true;
    },
  });
  assert.equal(aborted, true);
});

test("uncertainty defaults and the first unwritten path", () => {
  const work = uncertaintyDefaults("work");
  assert.equal(work.single_file_edit, true);
  assert.equal(work.needs_repo_reasoning, false);
  assert.equal(work.unfamiliar_stack, true);
  assert.equal(work.spec_exists, true);
  assert.equal(work.reversible, true);
  const escalate = uncertaintyDefaults("escalate");
  assert.equal(escalate.single_file_edit, false);
  assert.equal(escalate.needs_repo_reasoning, true);
  assert.equal(firstUnwrittenPath("touch src/a.ts then src/b.ts", ["src/a.ts"]), "src/b.ts");
  assert.equal(firstUnwrittenPath(null, []), "(unknown)");
});
