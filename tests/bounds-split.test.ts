import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import boundsExtension from "../extensions/bounds.ts";
import { clearHold, writeHold } from "../lib/quota.ts";
import {
  beginUserTurn,
  boundReason,
  recordInference,
  DEFAULT_BOUNDS,
  noteWrittenFile,
  resetTelemetryForTests,
} from "../lib/telemetry.ts";

const INDEX = `<!-- agent-memory-schema: 1 -->
# Notes index — read this first

## Notes

| Topic | File | Status | One-liner |
|---|---|---|---|
| How to write notes | [README.md](README.md) | meta | layers |

## Active next

| # | Item | Source | Added |
|---|---|---|---|
| 1 | resume | human | 2026-09-23 |

## Do not

- none
`;

function workspace(): { dir: string; settings: string } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-build-bounds-"));
  fs.writeFileSync(path.join(dir, "AGENTS.md"), "# test\n");
  const notes = path.join(dir, ".agent", "notes");
  fs.mkdirSync(notes, { recursive: true });
  fs.writeFileSync(path.join(notes, "INDEX.md"), INDEX);
  const settings = path.join(dir, "settings.json");
  fs.writeFileSync(
    settings,
    JSON.stringify({
      defaultProvider: "openai-codex",
      defaultModel: "gpt-6-sol",
      modelThinkingLevels: { "openai-codex/gpt-6-sol": "medium", "openai-codex/gpt-6-luna": "medium" },
      memoryGate: { enabled: true, autoScaffold: false, indexPath: ".agent/notes/INDEX.md" },
      routing: {
        enabled: false,
        tiers: {
          scout: "openai-codex/gpt-6-luna",
          work: "openai-codex/gpt-6-sol",
          escalate: "openai-codex/gpt-6-sol",
          explain: "openai-codex/gpt-6-luna",
        },
      },
      bounds: {
        enabled: true,
        maxTurnPromptTokens: 50_000_000,
        maxTurnCostUsd: 30,
      },
    }),
  );
  return { dir, settings };
}

function fakePi() {
  const handlers = new Map<string, ((event: Record<string, unknown>, ctx: Record<string, unknown>) => unknown)[]>();
  const pi = {
    handlers,
    sent: "",
    modelSet: false,
    model: null as { provider: string; id: string } | null,
    thinking: "",
    on(event: string, handler: (event: Record<string, unknown>, ctx: Record<string, unknown>) => unknown) {
      const list = handlers.get(event) ?? [];
      list.push(handler);
      handlers.set(event, list);
    },
    appendEntry() {},
    registerTool() {},
    sendMessage() {},
    sendUserMessage(text: string) {
      pi.sent = text;
    },
    async setModel(model: { provider: string; id: string }) {
      pi.modelSet = true;
      pi.model = model;
      return true;
    },
    setThinkingLevel(level: string) {
      pi.thinking = level;
    },
    async emit(event: string, payload: Record<string, unknown>, ctx: Record<string, unknown>) {
      for (const handler of handlers.get(event) ?? []) await handler(payload, ctx);
    },
  };
  return pi;
}

function withSettings(settings: string, fn: () => Promise<void>): Promise<void> {
  const previousSettings = process.env.PI_BUILD_SETTINGS;
  const previousDb = process.env.PI_BUILD_TELEMETRY_DB;
  process.env.PI_BUILD_SETTINGS = settings;
  process.env.PI_BUILD_TELEMETRY_DB = path.join(path.dirname(settings), "telemetry.db");
  resetTelemetryForTests();
  return fn().finally(() => {
    if (previousSettings === undefined) delete process.env.PI_BUILD_SETTINGS;
    else process.env.PI_BUILD_SETTINGS = previousSettings;
    if (previousDb === undefined) delete process.env.PI_BUILD_TELEMETRY_DB;
    else process.env.PI_BUILD_TELEMETRY_DB = previousDb;
    resetTelemetryForTests();
  });
}

async function repeatToolResult(pi: ReturnType<typeof fakePi>, ctx: Record<string, unknown>, count = 5) {
  for (let i = 0; i < count; i++) {
    await pi.emit("tool_result", {
      toolName: "read", input: { path: "src/repeated.ts" },
      content: [{ type: "text", text: "same result" }], isError: false,
    }, ctx);
  }
}

test("token and cost budgets are the only bound reasons", () => {
  const base = {
    sessionId: "s",
    turnId: "t",
    loopIndex: 1,
    elapsedMs: 1,
    consecutiveFailures: 0,
    reads: 0,
    edits: 0,
    promptTokens: 0,
    costUsd: 0,
  };
  assert.match(boundReason({ ...base, promptTokens: DEFAULT_BOUNDS.maxTurnPromptTokens }) ?? "", /prompt tokens/);
  assert.match(boundReason({ ...base, costUsd: DEFAULT_BOUNDS.maxTurnCostUsd }) ?? "", /turn cost/);
  assert.equal(boundReason({ ...base, loopIndex: 60, elapsedMs: 60_000_000, consecutiveFailures: 3, reads: 6 }), null);
});

test("a budget bound checkpoints written files and stops without retry", async () => {
  const { dir, settings } = workspace();
  await withSettings(settings, async () => {
    const bounds = fakePi();
    await boundsExtension(bounds as never);
    beginUserTurn("sess", "budget prompt");
    noteWrittenFile("src/budget.ts");
    recordInference({ tier: "work", model: "gpt-6-luna", promptTokens: DEFAULT_BOUNDS.maxTurnPromptTokens });
    let aborted = false;
    await bounds.emit("message_end", {}, {
      abort() { aborted = true; },
      cwd: dir,
      sessionManager: { getSessionId: () => "sess" },
      model: { provider: "openai-codex", id: "gpt-6-luna" },
      thinkingLevel: "medium",
      modelRegistry: registry(),
    });
    assert.equal(aborted, true);
    assert.equal(bounds.modelSet, false);
    assert.equal(bounds.sent, "");
    assert.match(fs.readFileSync(path.join(dir, ".agent/notes/INDEX.md"), "utf8"), /bounded at max turn prompt tokens.*src\/budget\.ts/);
  });
});

test("disabling routing leaves the bounds running", async () => {
  const { dir, settings } = workspace();
  await withSettings(settings, async () => {
    const bounds = fakePi();
    await boundsExtension(bounds as never);
    assert.ok((bounds.handlers.get("message_end") ?? []).length > 0);

    beginUserTurn("sess", "original prompt");
    let aborted = false;
    await repeatToolResult(bounds, {
      abort() {
        aborted = true;
      },
      cwd: dir,
      sessionManager: { getSessionId: () => "sess" },
      modelRegistry: { getAll: () => [], find: () => undefined },
    });
    assert.equal(aborted, true);
    assert.equal(bounds.sent, "");
  });
});

test("a Luna bound retries once on GPT-6 Sol at medium", async () => {
  const { dir, settings } = workspace();
  await withSettings(settings, async () => {
    const bounds = fakePi();
    await boundsExtension(bounds as never);
    beginUserTurn("sess", "original prompt");
    noteWrittenFile("src/a.ts");
    const model = { provider: "openai-codex", id: "gpt-6-luna" };
    const sol = { provider: "openai-codex", id: "gpt-6-sol" };
    let aborted = false;
    const ctx = {
      abort() {
        aborted = true;
      },
      cwd: dir,
      sessionManager: { getSessionId: () => "sess" },
      model,
      thinkingLevel: "medium",
      modelRegistry: {
        getAll: () => [model, sol],
        find: (provider: string, id: string) => [model, sol].find((candidate) => candidate.provider === provider && candidate.id === id),
      },
    };
    await repeatToolResult(bounds, ctx);
    assert.equal(aborted, true);
    assert.equal(bounds.modelSet, true);
    assert.deepEqual(bounds.model, sol);
    assert.equal(bounds.thinking, "medium");
    assert.match(bounds.sent, /^bounded at /);
    assert.match(bounds.sent, /src\/a\.ts/);

    const first = bounds.sent;
    bounds.sent = "";
    beginUserTurn("sess", first);
    noteWrittenFile("src/b.ts");
    await bounds.emit("before_agent_start", { prompt: first, systemPromptOptions: { sections: {} } }, ctx);
    await repeatToolResult(bounds, ctx);
    assert.equal(bounds.sent, "");
  });
});

function registry() {
  const luna = { provider: "openai-codex", id: "gpt-6-luna" };
  const sol = { provider: "openai-codex", id: "gpt-6-sol" };
  return {
    getAll: () => [luna, sol],
    find: (provider: string, id: string) => [luna, sol].find((candidate) => candidate.provider === provider && candidate.id === id),
  };
}

test("a bound does not retry while a quota hold file exists", async () => {
  const { dir, settings } = workspace();
  const holdPath = path.join(dir, "quota-hold.json");
  const previousHold = process.env.PI_BUILD_QUOTA_HOLD;
  process.env.PI_BUILD_QUOTA_HOLD = holdPath;
  writeHold(holdPath, { reason: "5h", hard: false, setAt: "2026-09-26T00:00:00Z", windows: [] });
  try {
    await withSettings(settings, async () => {
      const bounds = fakePi();
      await boundsExtension(bounds as never);
      beginUserTurn("sess", "original prompt");
      noteWrittenFile("src/a.ts");
      let aborted = false;
      const ctx = {
        abort() {
          aborted = true;
        },
        cwd: dir,
        sessionManager: { getSessionId: () => "sess" },
        model: { provider: "openai-codex", id: "gpt-6-luna" },
        thinkingLevel: "medium",
        modelRegistry: registry(),
      };
      await repeatToolResult(bounds, ctx);
      assert.equal(aborted, true);
      assert.equal(bounds.modelSet, false);
      assert.equal(bounds.sent, "");

      clearHold(holdPath);
      await bounds.emit("before_agent_start", { prompt: "other", systemPromptOptions: { sections: {} } }, ctx);
      beginUserTurn("sess", "original prompt");
      noteWrittenFile("src/b.ts");
      await repeatToolResult(bounds, ctx);
      assert.equal(bounds.modelSet, true);
      assert.match(bounds.sent, /^bounded at /);
    });
  } finally {
    if (previousHold === undefined) delete process.env.PI_BUILD_QUOTA_HOLD;
    else process.env.PI_BUILD_QUOTA_HOLD = previousHold;
    clearHold(holdPath);
  }
});

test("a GPT-6 Sol turn at high thinking does not retry", async () => {
  const { dir, settings } = workspace();
  await withSettings(settings, async () => {
    const bounds = fakePi();
    await boundsExtension(bounds as never);
    beginUserTurn("sess", "original prompt");
    noteWrittenFile("src/a.ts");
    await repeatToolResult(bounds, {
      abort() {},
      cwd: dir,
      sessionManager: { getSessionId: () => "sess" },
      model: { provider: "openai-codex", id: "gpt-6-sol" },
      thinkingLevel: "high",
      modelRegistry: registry(),
    });
    assert.equal(bounds.modelSet, false);
    assert.equal(bounds.sent, "");
  });
});

test("PI_BUILD_RETRY=0 skips the bounds retry", async () => {
  const { dir, settings } = workspace();
  const previous = process.env.PI_BUILD_RETRY;
  process.env.PI_BUILD_RETRY = "0";
  try {
    await withSettings(settings, async () => {
      const bounds = fakePi();
      await boundsExtension(bounds as never);
      beginUserTurn("sess", "original prompt");
      noteWrittenFile("src/a.ts");
      let aborted = false;
      await repeatToolResult(bounds, {
        abort() {
          aborted = true;
        },
        cwd: dir,
        sessionManager: { getSessionId: () => "sess" },
        model: { provider: "openai-codex", id: "gpt-6-luna" },
        thinkingLevel: "medium",
        modelRegistry: registry(),
      });
      assert.equal(aborted, true);
      assert.equal(bounds.modelSet, false);
      assert.equal(bounds.sent, "");
    });
  } finally {
    if (previous === undefined) delete process.env.PI_BUILD_RETRY;
    else process.env.PI_BUILD_RETRY = previous;
  }
});
