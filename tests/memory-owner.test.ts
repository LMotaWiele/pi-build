import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import memoryGateExtension from "../extensions/memory-gate.ts";
import recapExtension from "../extensions/recap.ts";
import { beginUserTurn, resetTelemetryForTests, setOpenNote } from "../lib/telemetry.ts";

const INDEX = `<!-- agent-memory-schema: 1 -->
# Notes index — read this first

## Notes

| Topic | File | Status | One-liner |
|---|---|---|---|
| How to write notes | [README.md](README.md) | meta | layers |

## Active next

| # | Item | Source | Added |
|---|---|---|---|
| 1 | keep the claim | human | 2026-09-23 |

## Do not

- do not drop the criteria
`;

function project(recap: boolean): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-build-memory-"));
  fs.writeFileSync(path.join(dir, "AGENTS.md"), "# test\n");
  const notes = path.join(dir, ".agent", "notes");
  fs.mkdirSync(notes, { recursive: true });
  fs.writeFileSync(path.join(notes, "INDEX.md"), INDEX);
  fs.writeFileSync(
    path.join(dir, "settings.json"),
    JSON.stringify({
      memoryGate: { enabled: true, autoScaffold: false, injectIndexOnSessionStart: true, blockRawNotesReads: false },
      recap: { enabled: recap },
      routing: { enabled: false },
      bounds: { enabled: false },
    }),
  );
  return dir;
}

function fakePi() {
  const handlers = new Map<string, ((event: Record<string, unknown>, ctx: Record<string, unknown>) => unknown)[]>();
  return {
    handlers,
    on(event: string, handler: (event: Record<string, unknown>, ctx: Record<string, unknown>) => unknown) {
      const list = handlers.get(event) ?? [];
      list.push(handler);
      handlers.set(event, list);
    },
    appendEntry() {},
    registerTool() {},
    sendMessage() {},
    setModel: async () => true,
    setThinkingLevel() {},
    async emit(event: string, payload: Record<string, unknown>, ctx: Record<string, unknown>) {
      for (const handler of handlers.get(event) ?? []) await handler(payload, ctx);
    },
  };
}

async function assemble(order: "memory-first" | "recap-first", recapOn: boolean) {
  const dir = project(recapOn);
  const previousSettings = process.env.PI_BUILD_SETTINGS;
  const previousDb = process.env.PI_BUILD_TELEMETRY_DB;
  process.env.PI_BUILD_SETTINGS = path.join(dir, "settings.json");
  process.env.PI_BUILD_TELEMETRY_DB = path.join(dir, "telemetry.db");
  resetTelemetryForTests();
  try {
    const pi = fakePi();
    if (order === "memory-first") {
      await memoryGateExtension(pi as never);
      recapExtension(pi as never);
    } else {
      recapExtension(pi as never);
      await memoryGateExtension(pi as never);
    }
    beginUserTurn("sess", "same prompt");
    setOpenNote({
      path: path.join(dir, "note.md"),
      topic: "t",
      currentClaim: "the harness keeps the claim",
      preCommitted: [{ if: "tests fail", then: "revert" }],
    });
    let writes = 0;
    const sections = new Proxy({} as Record<string, string>, {
      set(target, key, value) {
        if (key === "pi_build_memory") writes += 1;
        target[key as string] = String(value);
        return true;
      },
    });
    await pi.emit(
      "before_agent_start",
      { prompt: "same prompt", systemPromptOptions: { sections } },
      { cwd: dir, sessionManager: { getSessionId: () => "sess" } },
    );
    return { text: sections.pi_build_memory ?? "", writes };
  } finally {
    if (previousSettings === undefined) delete process.env.PI_BUILD_SETTINGS;
    else process.env.PI_BUILD_SETTINGS = previousSettings;
    if (previousDb === undefined) delete process.env.PI_BUILD_TELEMETRY_DB;
    else process.env.PI_BUILD_TELEMETRY_DB = previousDb;
    resetTelemetryForTests();
  }
}

test("recap owns pi_build_memory in either load order", async () => {
  for (const order of ["memory-first", "recap-first"] as const) {
    const assembled = await assemble(order, true);
    assert.equal(assembled.writes, 1, order);
    assert.match(assembled.text, /the harness keeps the claim/);
    assert.match(assembled.text, /If tests fail then revert/);
  }
});

test("memory-gate writes pi_build_memory when recap is disabled", async () => {
  const assembled = await assemble("memory-first", false);
  assert.equal(assembled.writes, 1);
  assert.match(assembled.text, /Active next/);
  assert.doesNotMatch(assembled.text, /the harness keeps the claim/);
});
