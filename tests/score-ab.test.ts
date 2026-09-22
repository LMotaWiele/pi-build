import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { parentWroteFixture, scoreDatabase, setVerdict, underFixture } from "../lib/score-ab.ts";

test("a bash command that names the fixture is not a parent write", () => {
  assert.equal(underFixture("tests/fixtures/ab/src/types.ts"), true);
  assert.equal(underFixture("/home/george-contis/src/pi-build/tests/fixtures/ab/src/types.ts"), true);
  assert.equal(underFixture("tests/fixtures/about.ts"), false);
  const wrote = parentWroteFixture([
    {
      toolName: "bash",
      outcome: "success",
      path: null,
      arguments: JSON.stringify({ command: "find tests/fixtures/ab -name '*.ts'" }),
    },
  ]);
  assert.equal(wrote, false);
  assert.equal(parentWroteFixture([
    { toolName: "edit", outcome: "success", path: "tests/fixtures/ab/src/types.ts", arguments: null },
  ]), true);
});

test("rule 0 matches before a void arm can look like NEITHER", () => {
  const voidArm = [
    { arm: "A", voidReason: null, completed: true, totalPromptTokens: 1, totalCostUsd: 1 },
    { arm: "A", voidReason: null, completed: true, totalPromptTokens: 1, totalCostUsd: 1 },
    { arm: "A", voidReason: null, completed: false, totalPromptTokens: 1, totalCostUsd: 1 },
    { arm: "B", voidReason: "0 child edits", completed: false, totalPromptTokens: 1, totalCostUsd: 1 },
    { arm: "B", voidReason: "0 child edits", completed: false, totalPromptTokens: 1, totalCostUsd: 1 },
    { arm: "B", voidReason: "0 child edits", completed: false, totalPromptTokens: 1, totalCostUsd: 1 },
  ];
  assert.equal(setVerdict(voidArm), "VOID");
  const neither = voidArm.map((trial) => (
    trial.arm === "B" ? { ...trial, voidReason: null, completed: false } : { ...trial, completed: false }
  ));
  assert.equal(setVerdict(neither), "NEITHER");
});

test("recorded sets score to the §3.6.1 verdicts", () => {
  const files = [
    "/tmp/pi-build-ab/telemetry.db",
    "/tmp/pi-build-ab-set/telemetry.db",
    "/tmp/pi-build-ab-set2/telemetry.db",
    "/tmp/pi-build-ab-set3/telemetry.db",
  ];
  for (const file of files) assert.equal(fs.existsSync(file), true, file);
  const open = (file: string) => scoreDatabase(new DatabaseSync(file, { readOnly: true }));

  const pair = open(files[0]!);
  assert.equal(pair.orphans, 0);
  assert.equal(pair.trials[0]?.voidReason?.includes("consecutive tool failures"), true);
  assert.equal(pair.trials[1]?.childEdits, 0);
  assert.match(pair.trials[1]?.voidReason ?? "", /0 child edits/);

  const six = open(files[1]!);
  assert.equal(six.orphans, 0);
  const armA = six.trials.filter((trial) => trial.arm === "A");
  const armB = six.trials.filter((trial) => trial.arm === "B");
  assert.equal(armA.filter((trial) => trial.completed).length, 2);
  assert.equal(armA.filter((trial) => !trial.voidReason && !trial.completed && trial.boundReason?.includes("no progress")).length, 1);
  assert.equal(armB.every((trial) => trial.childEdits === 0 && trial.voidReason), true);
  assert.equal(six.verdict, "VOID");

  const rerun = open(files[2]!);
  assert.equal(rerun.orphans, 0);
  const trial2 = rerun.trials.find((trial) => trial.trial === 2);
  assert.equal(trial2?.childEdits, 6);
  assert.equal(trial2?.parentWrote, false);
  assert.equal(trial2?.voidReason, null);
  assert.match(trial2?.boundReason ?? "", /wall clock 645510ms/);
  const bashDb = new DatabaseSync(files[2]!, { readOnly: true });
  const bash = bashDb.prepare(`
    SELECT COUNT(*) AS n FROM tool_calls
    WHERE turn_id = '30c6db7f-4f6b-461a-ae53-f46be07f114b'
      AND tool_name = 'bash' AND arguments LIKE '%tests/fixtures/ab/%'
  `).get() as { n: number };
  bashDb.close();
  assert.ok(bash.n > 0);

  const latest = open(files[3]!);
  assert.equal(latest.orphans, 0);
  assert.equal(latest.trials.filter((trial) => trial.arm === "A" && trial.completed).length, 3);
  assert.equal(latest.trials.filter((trial) => trial.arm === "B").every((trial) => trial.childEdits === 0 && trial.voidReason), true);
  assert.equal(latest.verdict, "VOID");
});
