import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, test } from "node:test";
import { execFileSync } from "node:child_process";

// Same arrangement as tests/pipeline-tool.test.ts: pi owns the runtime TypeBox/TUI.
const localModules = path.resolve(import.meta.dirname, "../../../node_modules");
let linked = false;
if (!fs.existsSync(localModules)) {
  const piBinary = fs.realpathSync(execFileSync("which", ["pi"], { encoding: "utf8" }).trim());
  const piPackage = path.dirname(path.dirname(path.dirname(piBinary)));
  try {
    fs.symlinkSync(path.join(piPackage, "node_modules"), localModules, "dir");
    linked = true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
  }
}
const { default: pipelineExtension } = await import("../../../extensions/pipeline.ts");
const { STOP_AND_REPORT } = await import("../../../lib/pipeline.ts");
const { initialProgress, parseProgressLine, progressSummary, reduceProgress } = await import("../../../lib/progress.ts");
after(() => { if (linked) fs.unlinkSync(localModules); });

const runner = `#!/usr/bin/env node
const mode = process.env.FAKE_PIPELINE_MODE;
const out = (e) => process.stdout.write(JSON.stringify(e) + '\\n');
if (mode === 'plan') out({ type: 'done', ok: true, branch: 'pipeline/SPEC-0042-x', summary: 'plan gate passed' });
if (mode === 'landed') out({ type: 'done', ok: true, landed: 'main', runRecord: 'docs/specs/SPEC-0042-run.md', summary: 'spec pass, plan pass', summaryPath: '/runs/SPEC-0042-x/s/summary.md' });
if (mode === 'kept') out({ type: 'done', ok: true, branch: 'pipeline/SPEC-0042-x', runRecord: 'docs/specs/SPEC-0042-run.md', summary: 'main moved since the run started', summaryPath: '/runs/SPEC-0042-x/s/summary.md' });
if (mode === 'fail') out({ type: 'done', ok: false, summary: 'plan gate failed', summaryPath: '/runs/SPEC-0042-x/s/summary.md' });
const code = mode === 'fail' ? 1 : 0;
process.stdout.write('', () => process.exit(code));
`;

type Tool = { execute: (...args: any[]) => Promise<any>; description: string };

async function setup(t: any, mode: string) {
  const harness = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "spec19-harness-")));
  const target = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "spec19-target-")));
  t.after(() => { fs.rmSync(harness, { recursive: true, force: true }); fs.rmSync(target, { recursive: true, force: true }); });
  fs.mkdirSync(path.join(harness, "bin"));
  fs.writeFileSync(path.join(harness, "bin", "pi-implement"), runner, { mode: 0o755 });
  execFileSync("git", ["init", "-q", target]);
  const previous = process.env.FAKE_PIPELINE_MODE;
  process.env.FAKE_PIPELINE_MODE = mode;
  t.after(() => { if (previous === undefined) delete process.env.FAKE_PIPELINE_MODE; else process.env.FAKE_PIPELINE_MODE = previous; });
  const registered: Tool[] = [];
  await pipelineExtension({ registerTool(tool: Tool) { registered.push(tool); } } as any, { harnessRoot: harness });
  return { tool: registered[0], target };
}
const text = (result: any): string => result.content[0].text;

test("done events carry where the run landed and where its summary is", () => {
  const event = parseProgressLine(JSON.stringify({ type: "done", ok: true, landed: "main", runRecord: "r.md", summaryPath: "/s/summary.md" }));
  assert.ok(event);
  assert.equal((event as any).landed, "main");
  assert.equal((event as any).summaryPath, "/s/summary.md");
  assert.equal(parseProgressLine(JSON.stringify({ type: "done", ok: true, landed: 3 })), null);
  assert.equal(parseProgressLine(JSON.stringify({ type: "done", ok: true, summaryPath: false })), null);
});

test("a landed run says where it landed and links its summary; a kept branch still reads as a hand-off", () => {
  const landed = progressSummary(reduceProgress(initialProgress("0042"), { type: "done", ok: true, landed: "main", runRecord: "r.md", summaryPath: "/s/summary.md" } as any));
  assert.match(landed, /Landed on main/);
  assert.match(landed, /Summary: \/s\/summary\.md/);
  assert.ok(!/Branch:/.test(landed));
  const kept = progressSummary(reduceProgress(initialProgress("0042"), { type: "done", ok: true, branch: "b", runRecord: "r.md" } as any));
  assert.match(kept, /Handed off/);
  assert.match(kept, /Branch: b/);
});

test("a run that landed is a success without the stop sentence", async (t) => {
  const { tool, target } = await setup(t, "landed");
  const result = await tool.execute("c", { spec: "0042" }, undefined, () => {}, { cwd: target });
  assert.equal(result.isError, false, text(result));
  assert.match(text(result), /Landed on main/);
  assert.match(text(result), /summary\.md/);
  assert.ok(!text(result).includes(STOP_AND_REPORT));
});

test("a run that kept its review branch is a success that names the branch and the reason", async (t) => {
  const { tool, target } = await setup(t, "kept");
  const result = await tool.execute("c", { spec: "0042" }, undefined, () => {}, { cwd: target });
  assert.equal(result.isError, false, text(result));
  assert.match(text(result), /pipeline\/SPEC-0042-x/);
  assert.match(text(result), /main moved/);
});

test("a successful plan-only call is not an error and says how to continue", async (t) => {
  const { tool, target } = await setup(t, "plan");
  const result = await tool.execute("c", { spec: "0042", planOnly: true }, undefined, () => {}, { cwd: target });
  assert.equal(result.isError, false, text(result));
  assert.match(text(result), /resume: true/);
  assert.ok(!text(result).includes(STOP_AND_REPORT));
});

test("a failed run is still an error with the stop sentence, and points at its summary", async (t) => {
  const { tool, target } = await setup(t, "fail");
  const result = await tool.execute("c", { spec: "0042" }, undefined, () => {}, { cwd: target });
  assert.equal(result.isError, true);
  assert.match(text(result), /Summary: \/runs\/SPEC-0042-x\/s\/summary\.md/);
  assert.ok(text(result).trimEnd().endsWith(STOP_AND_REPORT));
});

test("the description says runs land on the current branch when it has not moved", async (t) => {
  const { tool } = await setup(t, "landed");
  assert.match(tool.description, /fast-forward/i);
  assert.ok(!/never writes main/.test(tool.description));
  assert.ok(tool.description.includes(STOP_AND_REPORT));
  assert.match(JSON.stringify((tool as any).parameters), /\.zip/, "the spec parameter says a downloaded .md or .zip is accepted");
});
