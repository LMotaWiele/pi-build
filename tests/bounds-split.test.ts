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
  bumpLoopIndex,
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
      defaultModel: "openai-codex/gpt-5.6-sol",
      modelThinkingLevels: { "openai-codex/gpt-5.6-sol": "high" },
      memoryGate: { enabled: true, autoScaffold: false, indexPath: ".agent/notes/INDEX.md" },
      routing: {
        enabled: false,
        tiers: {
          scout: "openai-codex/gpt-5.6-sol",
          work: "openai-codex/gpt-5.6-sol",
          escalate: "openai-codex/gpt-5.6-sol",
          explain: "openai-codex/gpt-5.6-sol",
        },
      },
      bounds: {
        enabled: true,
        maxLoopDepth: 1,
        maxTurnWallClockMs: 60_000_000,
        maxConsecutiveToolFailures: 3,
        noProgressReads: 6,
        maxTurnPromptTokens: 20_000_000,
        maxTurnCostUsd: 12,
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
    async setModel() {
      pi.modelSet = true;
      return true;
    },
    setThinkingLevel() {},
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

test("token and cost budgets fire before the loop-depth backstop", () => {
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
  assert.match(boundReason({ ...base, loopIndex: 60, promptTokens: 1, costUsd: 1 }) ?? "", /loop depth/);
});

test("disabling routing leaves the bounds running", async () => {
  const { dir, settings } = workspace();
  await withSettings(settings, async () => {
    const bounds = fakePi();
    await boundsExtension(bounds as never);
    assert.ok((bounds.handlers.get("message_end") ?? []).length > 0);

    beginUserTurn("sess", "original prompt");
    bumpLoopIndex();
    let aborted = false;
    await bounds.emit("message_end", {}, {
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

test("a bound with written files retries once at escalate", async () => {
  const { dir, settings } = workspace();
  await withSettings(settings, async () => {
    const bounds = fakePi();
    await boundsExtension(bounds as never);
    beginUserTurn("sess", "original prompt");
    noteWrittenFile("src/a.ts");
    bumpLoopIndex();
    const model = { provider: "openai-codex", id: "gpt-5.6-sol" };
    let aborted = false;
    const ctx = {
      abort() {
        aborted = true;
      },
      cwd: dir,
      sessionManager: { getSessionId: () => "sess" },
      modelRegistry: {
        getAll: () => [model],
        find: (provider: string, id: string) => (provider === model.provider && id === model.id ? model : undefined),
      },
    };
    await bounds.emit("message_end", {}, ctx);
    assert.equal(aborted, true);
    assert.equal(bounds.modelSet, true);
    assert.match(bounds.sent, /^bounded at /);
    assert.match(bounds.sent, /src\/a\.ts/);

    const first = bounds.sent;
    bounds.sent = "";
    beginUserTurn("sess", first);
    noteWrittenFile("src/b.ts");
    bumpLoopIndex();
    await bounds.emit("before_agent_start", { prompt: first, systemPromptOptions: { sections: {} } }, ctx);
    await bounds.emit("message_end", {}, ctx);
    assert.equal(bounds.sent, "");
  });
});

function registry() {
  const model = { provider: "openai-codex", id: "gpt-5.6-sol" };
  return {
    getAll: () => [model],
    find: (provider: string, id: string) => (provider === model.provider && id === model.id ? model : undefined),
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
      bumpLoopIndex();
      let aborted = false;
      const ctx = {
        abort() {
          aborted = true;
        },
        cwd: dir,
        sessionManager: { getSessionId: () => "sess" },
        modelRegistry: registry(),
      };
      await bounds.emit("message_end", {}, ctx);
      assert.equal(aborted, true);
      assert.equal(bounds.modelSet, false);
      assert.equal(bounds.sent, "");

      clearHold(holdPath);
      await bounds.emit("before_agent_start", { prompt: "other", systemPromptOptions: { sections: {} } }, ctx);
      beginUserTurn("sess", "original prompt");
      noteWrittenFile("src/b.ts");
      bumpLoopIndex();
      await bounds.emit("message_end", {}, ctx);
      assert.equal(bounds.modelSet, true);
      assert.match(bounds.sent, /^bounded at /);
    });
  } finally {
    if (previousHold === undefined) delete process.env.PI_BUILD_QUOTA_HOLD;
    else process.env.PI_BUILD_QUOTA_HOLD = previousHold;
    clearHold(holdPath);
  }
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
      bumpLoopIndex();
      let aborted = false;
      await bounds.emit("message_end", {}, {
        abort() {
          aborted = true;
        },
        cwd: dir,
        sessionManager: { getSessionId: () => "sess" },
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
