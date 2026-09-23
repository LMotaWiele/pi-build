import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  attachTelemetry,
  beginUserTurn,
  declareHookExtension,
  resetTelemetryForTests,
  runTracedHook,
} from "../lib/telemetry.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("a named handler is recorded and a silent one is unknown:<seq>", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-build-hooks-"));
  const previous = process.env.PI_BUILD_TELEMETRY_DB;
  process.env.PI_BUILD_TELEMETRY_DB = path.join(dir, "telemetry.db");
  resetTelemetryForTests();
  try {
    beginUserTurn("sess", "prompt");
    const event = { type: "before_agent_start", systemPromptOptions: { sections: { kept: "aa" } } };
    await runTracedHook("before_agent_start", async (payload) => {
      declareHookExtension("recap");
      const sections = (payload.systemPromptOptions as { sections: Record<string, string> }).sections;
      sections.pi_build_memory = "Current claim: kept";
    }, event);
    await runTracedHook("before_agent_start", async (payload) => {
      const sections = (payload.systemPromptOptions as { sections: Record<string, string> }).sections;
      sections.pi_build_tools = "tools";
    }, event);

    const db = new DatabaseSync(process.env.PI_BUILD_TELEMETRY_DB);
    const rows = db
      .prepare("SELECT extension, seq, event, key_or_tool, bytes_before, bytes_after FROM hook_touches ORDER BY seq")
      .all() as { extension: string; seq: number; event: string; key_or_tool: string; bytes_before: number; bytes_after: number }[];
    assert.equal(rows.length, 2);
    assert.equal(rows[0].extension, "recap");
    assert.equal(rows[0].event, "before_agent_start");
    assert.equal(rows[0].key_or_tool, "pi_build_memory");
    assert.ok(rows[0].bytes_after > rows[0].bytes_before);
    assert.equal(rows[1].extension, "unknown:2");
    assert.equal(rows[1].seq, 2);
    db.exec(fs.readFileSync(path.join(root, "scripts/report-hooks.sql"), "utf8"));
    db.close();
  } finally {
    if (previous === undefined) delete process.env.PI_BUILD_TELEMETRY_DB;
    else process.env.PI_BUILD_TELEMETRY_DB = previous;
    resetTelemetryForTests();
  }
});

test("attachTelemetry names the extension that registered the handler", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-build-hooks-"));
  const previous = process.env.PI_BUILD_TELEMETRY_DB;
  process.env.PI_BUILD_TELEMETRY_DB = path.join(dir, "telemetry.db");
  resetTelemetryForTests();
  try {
    const handlers = new Map<string, ((event: Record<string, unknown>, ctx: Record<string, unknown>) => void)[]>();
    const pi = {
      on(event: string, handler: (event: Record<string, unknown>, ctx: Record<string, unknown>) => void) {
        const list = handlers.get(event) ?? [];
        list.push(handler);
        handlers.set(event, list);
      },
    };
    attachTelemetry(pi, "memory-gate");
    pi.on("tool_result", (event) => {
      event.content = [{ type: "text", text: "body" }];
    });
    beginUserTurn("sess", "prompt");
    const registered = handlers.get("tool_result") ?? [];
    const ours = registered[registered.length - 1];
    await runTracedHook("tool_result", ours, { toolName: "read", content: [] });
    const db = new DatabaseSync(process.env.PI_BUILD_TELEMETRY_DB);
    const rows = db.prepare("SELECT extension, key_or_tool FROM hook_touches").all() as { extension: string; key_or_tool: string }[];
    assert.equal(rows.at(-1)?.extension, "memory-gate");
    assert.equal(rows.at(-1)?.key_or_tool, "read");
    db.close();
  } finally {
    if (previous === undefined) delete process.env.PI_BUILD_TELEMETRY_DB;
    else process.env.PI_BUILD_TELEMETRY_DB = previous;
    resetTelemetryForTests();
  }
});
