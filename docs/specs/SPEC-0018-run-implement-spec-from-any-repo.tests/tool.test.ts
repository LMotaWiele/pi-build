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
after(() => { if (linked) fs.unlinkSync(localModules); });

const runner = `#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
fs.writeFileSync(path.join(process.env.FAKE_OUT, 'invocation.json'), JSON.stringify({ cwd: process.cwd(), args: process.argv.slice(2) }));
const mode = process.env.FAKE_PIPELINE_MODE;
const out = (e) => process.stdout.write(JSON.stringify(e) + '\\n');
if (mode === 'hold') out({ type: 'done', ok: false, summary: 'Quota hold' });
if (mode === 'preflight') process.stderr.write('spec has no .tests/ directory\\n');
if (mode === 'fail') out({ type: 'done', ok: false, summary: 'gate failed' });
if (mode === 'success') out({ type: 'done', ok: true, branch: 'pipeline/SPEC-00B1-x', runRecord: 'docs/specs/SPEC-00B1-run.md', summary: 'all green' });
const code = { hold: 75, preflight: 2, fail: 1, success: 0 }[mode] ?? 0;
process.stdout.write('', () => process.exit(code));
`;

type Tool = { execute: (...args: any[]) => Promise<any>; description: string; exposure?: string };

function tmp(t: any, prefix: string): string {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

function env(t: any, values: Record<string, string>) {
  for (const [key, value] of Object.entries(values)) {
    const previous = process.env[key];
    process.env[key] = value;
    t.after(() => { if (previous === undefined) delete process.env[key]; else process.env[key] = previous; });
  }
}

async function setup(t: any, mode: string, opts: { withRunner?: boolean } = {}) {
  const harness = tmp(t, "spec18-harness-");
  if (opts.withRunner !== false) {
    fs.mkdirSync(path.join(harness, "bin"));
    fs.writeFileSync(path.join(harness, "bin", "pi-implement"), runner, { mode: 0o755 });
  }
  const target = tmp(t, "spec18-target-");
  execFileSync("git", ["init", "-q", target]);
  fs.mkdirSync(path.join(target, "docs", "specs"), { recursive: true });
  fs.mkdirSync(path.join(target, "src"));
  const out = tmp(t, "spec18-out-");
  env(t, { FAKE_PIPELINE_MODE: mode, FAKE_OUT: out });
  const registered: Tool[] = [];
  await pipelineExtension({ registerTool(tool: Tool) { registered.push(tool); } } as any, { harnessRoot: harness });
  assert.equal(registered.length, 1);
  return { harness, target, out, tool: registered[0] };
}

const text = (result: any): string => result.content[0].text;
const invoked = (out: string) => fs.existsSync(path.join(out, "invocation.json"));

test("from a subdirectory of another repository, the harness's runner runs against that repository", async (t) => {
  const { target, out, tool } = await setup(t, "success");
  const result = await tool.execute("call", { spec: "00B1" }, undefined, () => {}, { cwd: path.join(target, "src") });
  const call = JSON.parse(fs.readFileSync(path.join(out, "invocation.json"), "utf8"));
  assert.equal(fs.realpathSync(call.cwd), target);
  assert.deepEqual(call.args, ["00B1", "--progress", "json", "--repo", target]);
  assert.equal(result.isError, false);
  assert.ok(!text(result).includes(STOP_AND_REPORT), "a hand-off does not tell the model to stop");
});

test("outside a git repository the tool refuses without starting the runner, and says not to implement inline", async (t) => {
  const { out, tool } = await setup(t, "success");
  const plain = tmp(t, "spec18-plain-");
  const result = await tool.execute("call", { spec: "00B1" }, undefined, () => {}, { cwd: plain });
  assert.equal(result.isError, true);
  assert.ok(text(result).includes(plain));
  assert.ok(text(result).trimEnd().endsWith(STOP_AND_REPORT));
  assert.equal(invoked(out), false);
});

test("a harness root without the runner is an error that says not to implement inline", async (t) => {
  const { target, tool } = await setup(t, "success", { withRunner: false });
  const result = await tool.execute("call", { spec: "00B1" }, undefined, () => {}, { cwd: target });
  assert.equal(result.isError, true);
  assert.ok(text(result).trimEnd().endsWith(STOP_AND_REPORT));
});

for (const mode of ["fail", "preflight", "hold"]) {
  test(`a ${mode} result is an error ending with the stop-and-report sentence`, async (t) => {
    const { target, tool } = await setup(t, mode);
    const result = await tool.execute("call", { spec: "00B1" }, undefined, () => {}, { cwd: target });
    assert.equal(result.isError, true);
    assert.ok(text(result).trimEnd().endsWith(STOP_AND_REPORT), text(result));
    if (mode === "hold") assert.match(text(result), /resume: true/);
    if (mode === "preflight") assert.match(text(result), /\.tests\//);
  });
}

test("the tool is declared directly and its description carries the stop-and-report sentence", async (t) => {
  const { tool } = await setup(t, "success");
  assert.equal(tool.exposure, "direct");
  assert.ok(tool.description.includes(STOP_AND_REPORT));
  assert.match(tool.description, /Sol plans, Luna implements each task, Sol integrates/);
});

test("without an override the harness root is this checkout", async (t) => {
  const registered: Tool[] = [];
  await pipelineExtension({ registerTool(tool: Tool) { registered.push(tool); } } as any);
  const target = tmp(t, "spec18-target-");
  execFileSync("git", ["init", "-q", target]);
  // The real runner refuses at once: the target has no /docs/specs.
  const result = await registered[0].execute("call", { spec: "00B1" }, undefined, () => {}, { cwd: target });
  assert.equal(result.isError, true);
  assert.match(text(result), /docs\/specs/);
  assert.ok(!text(result).includes("No pipeline runner found"));
});
