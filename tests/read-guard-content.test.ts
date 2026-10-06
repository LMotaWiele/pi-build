import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import readGuardExtension, { ReadGuard } from "../extensions/read-guard.ts";
import { unifiedDiff } from "../lib/markdown.ts";
import { resetEpochForTests, resetTelemetryForTests } from "../lib/telemetry.ts";

const NOTICE = "File changed since it was last read.\n";
const POINTER = /already read this turn at call \d+, unchanged/;

type Handler = (event: Record<string, unknown>, ctx: Record<string, unknown>) => unknown;

function textBlock(text: string) {
  return [{ type: "text", text }];
}

function resultText(content: unknown): string {
  if (!Array.isArray(content)) return "";
  return content.map((block) => (block && typeof block === "object" && typeof block.text === "string" ? block.text : "")).join("\n");
}

async function loadExtension(settings: Record<string, unknown>) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "read-guard-"));
  const settingsPath = path.join(dir, "settings.json");
  fs.writeFileSync(settingsPath, JSON.stringify(settings));
  const previousSettings = process.env.PI_BUILD_SETTINGS;
  const previousDb = process.env.PI_BUILD_TELEMETRY_DB;
  process.env.PI_BUILD_SETTINGS = settingsPath;
  process.env.PI_BUILD_TELEMETRY_DB = path.join(dir, "telemetry.db");
  resetTelemetryForTests();
  resetEpochForTests();
  const handlers = new Map<string, Handler[]>();
  readGuardExtension({
    on(event: string, handler: Handler) {
      const list = handlers.get(event) ?? [];
      list.push(handler);
      handlers.set(event, list);
    },
  } as never);
  const ctx = { cwd: dir, sessionManager: { getSessionId: () => "read-guard-content" } };
  return {
    dir,
    ctx,
    handlers,
    async prompt(text: string) {
      for (const handler of handlers.get("before_agent_start") ?? []) await handler({ prompt: text }, ctx);
    },
    async compact() {
      for (const handler of handlers.get("session_compact") ?? []) await handler({}, ctx);
    },
    async tool(event: Record<string, unknown>) {
      let current = { ...event };
      for (const handler of handlers.get("tool_result") ?? []) {
        const result = await handler(current, ctx) as { content?: unknown; isError?: boolean } | undefined;
        if (result?.content !== undefined) {
          current = { ...current, content: result.content, isError: result.isError ?? current.isError };
        }
      }
      return current;
    },
    restore() {
      if (previousSettings === undefined) delete process.env.PI_BUILD_SETTINGS;
      else process.env.PI_BUILD_SETTINGS = previousSettings;
      if (previousDb === undefined) delete process.env.PI_BUILD_TELEMETRY_DB;
      else process.env.PI_BUILD_TELEMETRY_DB = previousDb;
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
}

function guardSettings(extra: Record<string, unknown> = {}) {
  return { readGuard: { enabled: true, dedupeWithinTurn: true, diffOnRepeatAfterWrite: true, allowRangeReads: true, ...extra } };
}

async function withGuard(extra: Record<string, unknown> | undefined, body: (session: Awaited<ReturnType<typeof loadExtension>>) => Promise<void>) {
  const session = await loadExtension(guardSettings(extra));
  try {
    await session.prompt("read the file");
    await body(session);
  } finally {
    session.restore();
  }
}

function readEvent(id: string, filePath: string, text: string, extra: Record<string, unknown> = {}) {
  return {
    type: "tool_result",
    toolName: "read",
    toolCallId: id,
    input: { path: filePath, ...extra },
    content: textBlock(text),
    details: undefined,
    isError: false,
  };
}

test("V1 identical re-read returns the pointer", async () => {
  await withGuard(undefined, async (session) => {
    const file = path.join(session.dir, "a.ts");
    fs.writeFileSync(file, "value = 1\n");
    const first = await session.tool(readEvent("c1", "a.ts", "value = 1\n"));
    assert.equal(resultText(first.content), "value = 1\n");
    const second = await session.tool(readEvent("c2", "a.ts", "value = 1\n"));
    assert.match(resultText(second.content), /already read this turn at call 1, unchanged/);
    const third = await session.tool(readEvent("c3", "a.ts", "value = 1\n"));
    assert.match(resultText(third.content), /already read this turn at call 1, unchanged/);
  });
});

test("V2 external write is delivered and is not the pointer", async () => {
  await withGuard(undefined, async (session) => {
    const file = path.join(session.dir, "value.txt");
    fs.writeFileSync(file, "value = 1\n");
    await session.tool(readEvent("c1", "value.txt", "value = 1\n"));
    fs.writeFileSync(file, "value = 2\n");
    const second = await session.tool(readEvent("c2", "value.txt", "value = 2\n"));
    const text = resultText(second.content);
    assert.doesNotMatch(text, POINTER);
    assert.match(text, /value = 2/);
  });
});

test("V3 a Pi edit then re-read is not the pointer", async () => {
  await withGuard(undefined, async (session) => {
    const file = path.join(session.dir, "a.ts");
    const before = Array.from({ length: 40 }, (_, i) => `line ${i}`).join("\n");
    const after = before.replace("line 3", "line THREE");
    fs.writeFileSync(file, before);
    await session.tool(readEvent("c1", "a.ts", before));
    fs.writeFileSync(file, after);
    await session.tool({
      type: "tool_result",
      toolName: "edit",
      toolCallId: "e1",
      input: { path: "a.ts" },
      content: textBlock("edited"),
      details: undefined,
      isError: false,
    });
    const second = await session.tool(readEvent("c2", "a.ts", after));
    const text = resultText(second.content);
    assert.doesNotMatch(text, POINTER);
    assert.match(text, /File changed since it was last read/);
    assert.match(text, /THREE/);
  });
});

test("diffOnRepeatAfterWrite false returns the full file after a tracked edit", async () => {
  await withGuard({ diffOnRepeatAfterWrite: false }, async (session) => {
    const file = path.join(session.dir, "a.ts");
    fs.writeFileSync(file, "alpha\n");
    await session.tool(readEvent("c1", "a.ts", "alpha\n"));
    fs.writeFileSync(file, "beta\n");
    await session.tool({
      type: "tool_result",
      toolName: "write",
      toolCallId: "w1",
      input: { path: "a.ts" },
      content: textBlock("wrote"),
      details: undefined,
      isError: false,
    });
    const second = await session.tool(readEvent("c2", "a.ts", "beta\n"));
    assert.equal(resultText(second.content), "beta\n");
  });
});

test("V4 path aliases share one entry", async () => {
  await withGuard(undefined, async (session) => {
    const dir = path.join(session.dir, "src");
    fs.mkdirSync(dir);
    const real = path.join(dir, "a.ts");
    fs.writeFileSync(real, "value = 1\n");
    const link = path.join(session.dir, "alias.ts");
    fs.symlinkSync(real, link);
    await session.tool(readEvent("c1", "src/a.ts", "value = 1\n"));
    const aliases = ["./src/a.ts", real, "src/../src/a.ts", "alias.ts"];
    let n = 2;
    for (const alias of aliases) {
      const next = `value = ${n}\n`;
      fs.writeFileSync(real, next);
      const result = await session.tool(readEvent(`c${n}`, alias, next));
      const text = resultText(result.content);
      assert.doesNotMatch(text, POINTER, alias);
      assert.match(text, new RegExp(`value = ${n}`), alias);
      n += 1;
    }
    const shared = await session.tool(readEvent("c9", "src/a.ts", "value = 5\n"));
    assert.match(resultText(shared.content), POINTER);
  });
});

test("V5 ranges are independent and a changed range returns the full result", async () => {
  await withGuard(undefined, async (session) => {
    const file = path.join(session.dir, "a.ts");
    const original = "a\nb\nc\nd\n";
    fs.writeFileSync(file, original);
    await session.tool(readEvent("c1", "a.ts", "a\nb", { offset: 1, limit: 2 }));
    const other = await session.tool(readEvent("c2", "a.ts", "c\nd", { offset: 3, limit: 2 }));
    assert.equal(resultText(other.content), "c\nd");
    const changed = "A\nb\nc\nd\n";
    fs.writeFileSync(file, changed);
    const again = await session.tool(readEvent("c3", "a.ts", "A\nb", { offset: 1, limit: 2 }));
    assert.equal(resultText(again.content), "A\nb");
    const sameOther = await session.tool(readEvent("c4", "a.ts", "c\nd", { offset: 3, limit: 2 }));
    assert.match(resultText(sameOther.content), POINTER);
    const sameChanged = await session.tool(readEvent("c5", "a.ts", "A\nb", { offset: 1, limit: 2 }));
    assert.match(resultText(sameChanged.content), POINTER);
  });
});

test("V6 an error passes through and the recreated file is delivered", async () => {
  await withGuard(undefined, async (session) => {
    const file = path.join(session.dir, "a.ts");
    fs.writeFileSync(file, "value = 1\n");
    await session.tool(readEvent("c1", "a.ts", "value = 1\n"));
    fs.unlinkSync(file);
    const missing = await session.tool({
      ...readEvent("c2", "a.ts", "ENOENT: a.ts"),
      isError: true,
    });
    assert.equal(resultText(missing.content), "ENOENT: a.ts");
    fs.writeFileSync(file, "value = 2\n");
    const recreated = await session.tool(readEvent("c3", "a.ts", "value = 2\n"));
    assert.equal(resultText(recreated.content), "value = 2\n");
    fs.unlinkSync(file);
    await session.tool({ ...readEvent("c4", "a.ts", "ENOENT: a.ts"), isError: true });
    fs.writeFileSync(file, "value = 2\n");
    const sameBytes = await session.tool(readEvent("c5", "a.ts", "value = 2\n"));
    assert.equal(resultText(sameBytes.content), "value = 2\n");
  });
});

test("V7 a non-text result is unchanged and is not stored", async () => {
  await withGuard(undefined, async (session) => {
    const file = path.join(session.dir, "pic.png");
    fs.writeFileSync(file, "not really a png");
    const image = [
      { type: "text", text: "Read image file [image/png]" },
      { type: "image", data: "abc", mimeType: "image/png" },
    ];
    const event = {
      type: "tool_result",
      toolName: "read",
      toolCallId: "c1",
      input: { path: "pic.png" },
      content: image,
      details: undefined,
      isError: false,
    };
    const first = await session.tool(event);
    assert.deepEqual(first.content, image);
    const second = await session.tool({ ...event, toolCallId: "c2" });
    assert.deepEqual(second.content, image);
    const asText = await session.tool(readEvent("c3", "pic.png", "later text\n"));
    assert.equal(resultText(asText.content), "later text\n");
  });
});

test("V8 a large change returns the full result", async () => {
  await withGuard(undefined, async (session) => {
    const before = "alpha\n".repeat(30);
    const after = "z\n".repeat(4);
    const payload = NOTICE + unifiedDiff("a.ts", before, after);
    assert.ok(payload.length >= after.length);
    const file = path.join(session.dir, "a.ts");
    fs.writeFileSync(file, before);
    await session.tool(readEvent("c1", "a.ts", before));
    fs.writeFileSync(file, after);
    const second = await session.tool(readEvent("c2", "a.ts", after));
    assert.equal(resultText(second.content), after);
  });
});

test("V9 a new prompt or compaction delivers the file again", async () => {
  await withGuard(undefined, async (session) => {
    const file = path.join(session.dir, "a.ts");
    fs.writeFileSync(file, "body\n");
    await session.tool(readEvent("c1", "a.ts", "body\n"));
    const again = await session.tool(readEvent("c2", "a.ts", "body\n"));
    assert.match(resultText(again.content), POINTER);
    await session.prompt("read the file");
    const samePrompt = await session.tool(readEvent("c3", "a.ts", "body\n"));
    assert.match(resultText(samePrompt.content), POINTER);
    await session.compact();
    const afterCompact = await session.tool(readEvent("c4", "a.ts", "body\n"));
    assert.equal(resultText(afterCompact.content), "body\n");
    await session.prompt("a different prompt");
    const afterPrompt = await session.tool(readEvent("c5", "a.ts", "body\n"));
    assert.equal(resultText(afterPrompt.content), "body\n");
  });
});

test("V10 the disable switch passes every read through", async () => {
  const disabled = await loadExtension({ readGuard: { enabled: false } });
  try {
    assert.equal(disabled.handlers.get("tool_result"), undefined);
    const file = path.join(disabled.dir, "a.ts");
    fs.writeFileSync(file, "body\n");
    const first = await disabled.tool(readEvent("c1", "a.ts", "body\n"));
    const second = await disabled.tool(readEvent("c2", "a.ts", "body\n"));
    assert.equal(resultText(first.content), "body\n");
    assert.equal(resultText(second.content), "body\n");
  } finally {
    disabled.restore();
  }
  await withGuard({ dedupeWithinTurn: false }, async (session) => {
    const file = path.join(session.dir, "a.ts");
    fs.writeFileSync(file, "body\n");
    const first = await session.tool(readEvent("c1", "a.ts", "body\n"));
    const second = await session.tool(readEvent("c2", "a.ts", "body\n"));
    assert.equal(resultText(first.content), "body\n");
    assert.equal(resultText(second.content), "body\n");
  });
});

test("force bypass delivers the fresh text", async () => {
  await withGuard(undefined, async (session) => {
    const file = path.join(session.dir, "a.ts");
    fs.writeFileSync(file, "one\n");
    await session.tool(readEvent("c1", "a.ts", "one\n"));
    const forced = await session.tool(readEvent("c2", "a.ts", "two\n", { force: true }));
    assert.equal(resultText(forced.content), "two\n");
    const same = await session.tool(readEvent("c3", "a.ts", "two\n"));
    assert.match(resultText(same.content), POINTER);
  });
});

test("V11 property: a pointer never hides different content", () => {
  const seed = 20261006;
  const sequences = 500;
  const opsPerSequence = 24;
  console.log(`read-guard property seed ${seed} sequences ${sequences}`);
  const rand = mulberry32(seed);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "read-guard-prop-"));
  const real = path.join(dir, "f.txt");
  const link = path.join(dir, "link.txt");
  try {
    fs.writeFileSync(real, "L0-0\nL1-0\n");
    fs.symlinkSync(real, link);
    for (let sequence = 0; sequence < sequences; sequence += 1) {
      const guard = new ReadGuard();
      let text = lines(rand);
      fs.writeFileSync(real, text);
      let exists = true;
      const canonical = fs.realpathSync(real);
      const oracle = new Map<string, string>();
      const seen = new Set<string>([canonical]);
      const aliases = ["f.txt", "./f.txt", real, "link.txt"];
      const noteSeen = (alias: string) => {
        seen.add(path.resolve(dir, alias));
        seen.add(canonical);
      };
      const errorRead = (alias: string, range: { offset?: number; limit?: number }) => {
        const delivery = guard.deliver(deliveryInput(alias, dir, range, "missing", true));
        assert.equal(delivery.text, undefined, `error replaced text sequence ${sequence}`);
        if (seen.has(path.resolve(dir, alias))) clearOracle(oracle, canonical);
      };
      for (let op = 0; op < opsPerSequence; op += 1) {
        const roll = Math.floor(rand() * 10);
        const alias = aliases[Math.floor(rand() * aliases.length)]!;
        const range = ranges[Math.floor(rand() * ranges.length)]!;
        if (roll <= 3 || roll === 9) {
          if (!exists) {
            errorRead(alias, range);
            continue;
          }
          if (roll === 9) {
            const delivery = guard.deliver({
              path: alias,
              cwd: dir,
              ...range,
              force: false,
              isError: false,
              content: [
                { type: "text", text: "Read image file [image/png]" },
                { type: "image", data: "aa", mimeType: "image/png" },
              ],
              diffOnWrite: true,
            });
            assert.equal(delivery.text, undefined, `image replaced sequence ${sequence}`);
            continue;
          }
          noteSeen(alias);
          const fresh = sliceRange(text, range);
          const delivery = guard.deliver(deliveryInput(alias, dir, range, fresh, false));
          const key = `${canonical}\0${range.offset ?? ""}\0${range.limit ?? ""}`;
          if (delivery.suppressed) {
            assert.equal(delivery.text && POINTER.test(delivery.text), true);
            assert.equal(oracle.get(key), fresh, `pointer hid a change sequence ${sequence} op ${op}`);
          } else if (delivery.text) {
            assert.equal(range.offset == null && range.limit == null, true, `partial diff sequence ${sequence}`);
            assert.ok(delivery.text.startsWith(NOTICE));
            assert.ok(delivery.text.length < fresh.length);
            oracle.set(key, fresh);
          } else {
            oracle.set(key, fresh);
          }
          continue;
        }
        if (roll === 4 || roll === 5 || roll === 6) {
          text = lines(rand);
          fs.writeFileSync(real, text);
          exists = true;
          if (roll === 5) guard.recordWrite(alias, dir);
          if (roll === 6) guard.recordWrite(path.resolve(dir, alias), dir);
          continue;
        }
        if (roll === 7) {
          if (exists) fs.unlinkSync(real);
          exists = false;
          errorRead(alias, range);
          continue;
        }
        text = rand() < 0.5 ? text : lines(rand);
        fs.writeFileSync(real, text);
        exists = true;
      }
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  assert.equal(sequences, 500);
  assert.equal(seed, 20261006);
});

const ranges: Array<{ offset?: number; limit?: number }> = [
  {},
  { offset: 1, limit: 1 },
  { offset: 2, limit: 2 },
];

function deliveryInput(filePath: string, cwd: string, range: { offset?: number; limit?: number }, text: string, isError: boolean) {
  return {
    path: filePath,
    cwd,
    offset: range.offset,
    limit: range.limit,
    force: false,
    isError,
    content: textBlock(text),
    diffOnWrite: true,
  };
}

function clearOracle(oracle: Map<string, string>, canonical: string) {
  const prefix = `${canonical}\0`;
  for (const key of oracle.keys()) {
    if (key.startsWith(prefix)) oracle.delete(key);
  }
}

function sliceRange(text: string, range: { offset?: number; limit?: number }): string {
  const rows = text.split("\n");
  const start = range.offset == null ? 0 : Math.max(0, range.offset - 1);
  const end = range.limit == null ? rows.length : start + range.limit;
  return rows.slice(start, end).join("\n");
}

function lines(rand: () => number): string {
  const count = 2 + Math.floor(rand() * 4);
  return Array.from({ length: count }, (_, index) => `L${index}-${Math.floor(rand() * 1000)}`).join("\n");
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}
