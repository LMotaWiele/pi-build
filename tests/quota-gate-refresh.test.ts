import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import quotaGate from "../extensions/quota-gate.ts";
import { USAGE_URL } from "../lib/quota.ts";

test("quota retrieval redraws the footer throughout the same session", async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-quota-refresh-"));
  const savedFetch = globalThis.fetch;
  const savedEnv = { ...process.env };
  t.after(() => {
    globalThis.fetch = savedFetch;
    for (const key of ["PI_BUILD_QUOTA_HOLD", "PI_BUILD_QUOTA_OVERRIDE", "PI_BUILD_SETTINGS"]) {
      if (savedEnv[key] === undefined) delete process.env[key];
      else process.env[key] = savedEnv[key];
    }
    fs.rmSync(dir, { recursive: true, force: true });
  });
  process.env.PI_BUILD_QUOTA_HOLD = path.join(dir, "hold.json");
  process.env.PI_BUILD_QUOTA_OVERRIDE = path.join(dir, "override.json");
  process.env.PI_BUILD_SETTINGS = path.join(dir, "settings.json");
  fs.writeFileSync(process.env.PI_BUILD_SETTINGS, "{}");

  let fiveHour = 10;
  let weekly = 20;
  let polls = 0;
  let fail = false;
  globalThis.fetch = (async (url: unknown) => {
    assert.equal(url, USAGE_URL);
    polls++;
    if (fail) throw new Error("offline");
    return new Response(JSON.stringify({ rate_limit: {
      primary_window: { limit_window_seconds: 18000, used_percent: fiveHour, reset_at: 2000000000 },
      secondary_window: { limit_window_seconds: 604800, used_percent: weekly, reset_at: 2000000000 },
    } }));
  }) as typeof fetch;

  const sent: { text: string; options: unknown }[] = [];
  const handlers = new Map<string, (event: any, ctx: any) => unknown>();
  quotaGate({
    on(name: string, handler: (event: any, ctx: any) => unknown) { handlers.set(name, handler); },
    appendEntry() {},
    sendUserMessage(text: string, options: unknown) { sent.push({ text, options }); },
  } as any);
  let renders = 0;
  let lines: string[] = [];
  let footer: { render: (width: number) => string[]; dispose: () => void };
  const ctx = {
    mode: "tui", hasUI: true, model: { provider: "openai-codex", id: "test" },
    modelRegistry: { getApiKeyForProvider: async () => "test-token" },
    sessionManager: { getEntries: () => [] },
    ui: { setFooter(factory: any) {
      footer = factory({ requestRender() { renders++; lines = footer.render(200); } },
        { fg: (_color: string, text: string) => text, bold: (text: string) => text },
        { getGitBranch: () => null, getExtensionStatuses: () => new Map(),
          getAvailableProviderCount: () => 1, onBranchChange: () => () => {} });
    } },
  };
  const emit = async (name: string, event = {}) => handlers.get(name)?.(event, ctx);
  const expectQuota = (five: number, week: number) => {
    assert.match(lines.join("\n"), new RegExp(`5h ${five}% weekly ${week}%`));
  };
  await emit("session_start");
  expectQuota(10, 20);
  assert.equal(renders, 1);

  // HTTP quota headers redraw immediately, without an extra endpoint request.
  await emit("before_agent_start");
  await emit("after_provider_response", { status: 200, headers: {
    "x-codex-primary-used-percent": "11", "x-codex-secondary-used-percent": "21",
  } });
  expectQuota(11, 21);
  assert.equal(renders, 2);
  await emit("message_end", { message: { role: "assistant" } });
  assert.equal(polls, 1);

  // A subsequent WebSocket reply has no HTTP response event at all.
  fiveHour = 12; weekly = 22;
  await emit("message_end", { message: { role: "toolResult" } });
  assert.equal(polls, 1);
  await emit("message_end", { message: { role: "assistant" } });
  expectQuota(12, 22);
  assert.equal(polls, 2);
  assert.equal(renders, 3);

  // HTTP replies without quota headers and partial headers also refresh.
  fiveHour = 13; weekly = 23;
  await emit("after_provider_response", { status: 200, headers: {} });
  await emit("message_end", { message: { role: "assistant" } });
  expectQuota(13, 23);
  fiveHour = 14; weekly = 24;
  await emit("after_provider_response", { status: 200, headers: { "x-codex-primary-used-percent": "14" } });
  await emit("message_end", { message: { role: "assistant" } });
  expectQuota(14, 24);
  assert.equal(polls, 4);

  // A failed refresh preserves the last good readout and can recover next reply.
  fail = true;
  const previousRenders = renders;
  await emit("message_end", { message: { role: "assistant" } });
  expectQuota(14, 24);
  assert.equal(renders, previousRenders);
  fail = false; fiveHour = 15; weekly = 25;
  await emit("message_end", { message: { role: "assistant" } });
  expectQuota(15, 25);

  // A quota-reset resume must explicitly queue, even if the session is still busy.
  t.mock.timers.enable({ apis: ["Date"], now: Date.now() });
  Object.assign(ctx, { isIdle: () => false });
  Object.assign(ctx.ui, { notify() { t.mock.timers.tick(600_000); } });
  await emit("agent_end", { error: { status: 429, message: "usage limit reached" } });
  assert.deepEqual(sent, [{ text: "continue", options: { deliverAs: "followUp" } }]);

  ctx.model.provider = "other-provider";
  const previousPolls = polls;
  await emit("message_end", { message: { role: "assistant" } });
  assert.equal(polls, previousPolls);
  footer!.dispose();
});
