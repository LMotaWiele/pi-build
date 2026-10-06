import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import postEditTypecheck, {
  TYPECHECK_DEBOUNCE_MS,
  TYPECHECK_OUTPUT_LINES,
  TYPECHECK_TIMEOUT_MS,
  type CompilerRequest,
  type CompilerResult,
  type CompilerRunner,
  createPostEditTypecheck,
} from "../extensions/post-edit-typecheck.ts";
import { resetTelemetryForTests } from "../lib/telemetry.ts";

type Handler = (event: Record<string, unknown>, ctx: Record<string, unknown>) => unknown;

type Session = {
  dir: string;
  statuses: string[];
  widgets: Array<string[] | undefined>;
  execCalls: number;
  calls: CompilerRequest[];
  retarget: (next: string) => void;
  edit: (file?: string, extra?: Record<string, unknown>) => Promise<void>;
  restore: () => void;
};

function result(partial: Partial<CompilerResult> & Pick<CompilerResult, "code">): CompilerResult {
  return { signal: null, stdout: "", stderr: "", ...partial };
}

function begin(run?: CompilerRunner): Session {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "typecheck-hook-"));
  const settings = path.join(dir, "settings.json");
  fs.writeFileSync(settings, JSON.stringify({ postEditTypecheck: { enabled: true } }));
  const previousSettings = process.env.PI_BUILD_SETTINGS;
  const previousDb = process.env.PI_BUILD_TELEMETRY_DB;
  process.env.PI_BUILD_SETTINGS = settings;
  process.env.PI_BUILD_TELEMETRY_DB = path.join(dir, "telemetry.db");
  resetTelemetryForTests();
  const statuses: string[] = [];
  const widgets: Array<string[] | undefined> = [];
  const calls: CompilerRequest[] = [];
  const handlers = new Map<string, Handler[]>();
  let execCalls = 0;
  const pi = {
    on(event: string, handler: Handler) {
      const list = handlers.get(event) ?? [];
      list.push(handler);
      handlers.set(event, list);
    },
    exec() {
      execCalls += 1;
      throw new Error("pi.exec must not run the compiler");
    },
  };
  const wrapped: CompilerRunner = async (request) => {
    calls.push(request);
    if (!run) throw new Error("no compiler runner");
    return run(request);
  };
  if (run) createPostEditTypecheck(pi as never, { run: wrapped });
  else postEditTypecheck(pi as never);
  const ctx = {
    cwd: dir,
    ui: {
      setStatus(_key: string, value: string | undefined) {
        statuses.push(value ?? "");
      },
      setWidget(_key: string, lines: string[] | undefined) {
        widgets.push(lines);
      },
    },
  };
  return {
    dir,
    statuses,
    widgets,
    calls,
    get execCalls() {
      return execCalls;
    },
    retarget(next: string) {
      ctx.cwd = next;
    },
    async edit(file = "a.ts", extra: Record<string, unknown> = {}) {
      for (const handler of handlers.get("tool_result") ?? []) {
        await handler({ toolName: "edit", isError: false, input: { path: file }, ...extra }, ctx);
      }
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

function writeProject(dir: string, mode: "bin" | "missing" | "not-executable" = "bin") {
  fs.writeFileSync(path.join(dir, "tsconfig.json"), "{}\n");
  fs.writeFileSync(path.join(dir, "a.ts"), "export const value = 1;\n");
  if (mode === "missing") return;
  const binDir = path.join(dir, "node_modules", ".bin");
  fs.mkdirSync(binDir, { recursive: true });
  const bin = path.join(binDir, "tsc");
  fs.writeFileSync(bin, "#!/bin/sh\necho TYPES-RAN\nexit 0\n");
  fs.chmodSync(bin, mode === "not-executable" ? 0o644 : 0o755);
}

async function settle() {
  for (let i = 0; i < 20; i++) await Promise.resolve();
}

function terminals(statuses: string[]): string[] {
  return statuses.filter((value) => value !== "" && value !== "Running type check...");
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function expectedStatus(value: CompilerResult): string {
  if (value.timedOut) return "Type check did not run: timeout";
  if (value.spawnError) return `Type check did not run: ${value.spawnError}`;
  if (value.signal) return `Type check did not run: signal ${value.signal}`;
  if (value.code === 0) return "Types OK";
  return "Type errors found";
}

test.describe("post-edit typecheck status", { concurrency: 1 }, () => {
  test("V1 stub exit 0 reports Types OK", async (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const session = begin(async () => result({ code: 0, stdout: "clean\n" }));
    try {
      writeProject(session.dir);
      await session.edit();
      t.mock.timers.tick(TYPECHECK_DEBOUNCE_MS);
      await settle();
      assert.deepEqual(terminals(session.statuses), ["Types OK"]);
      assert.equal(session.calls.length, 1);
      assert.deepEqual(session.calls[0].args, ["--noEmit", "--pretty"]);
      assert.equal(session.execCalls, 0);
      await session.edit("b.js");
      await session.edit("c.ts", { isError: true });
      t.mock.timers.tick(TYPECHECK_DEBOUNCE_MS);
      await settle();
      assert.equal(session.calls.length, 1);
    } finally {
      session.restore();
    }
  });

  test("V2 stub exit 2 reports type errors and never Types OK", async (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const session = begin(async () => result({ code: 2, stderr: "error TS2322: bad\n" }));
    try {
      writeProject(session.dir);
      await session.edit("a.ts", { toolName: "write" });
      t.mock.timers.tick(TYPECHECK_DEBOUNCE_MS);
      await settle();
      assert.deepEqual(terminals(session.statuses), ["Type errors found"]);
      assert.equal(session.statuses.includes("Types OK"), false);
      assert.equal(session.widgets.at(-1)?.[0], "Type errors:");
      assert.equal(session.widgets.at(-1)?.includes("error TS2322: bad"), true);
    } finally {
      session.restore();
    }
  });

  test("V3 long output keeps the exit code and the last 30 lines", async (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const lines = Array.from({ length: 200 }, (_unused, index) => `L${String(index + 1).padStart(3, "0")}`);
    const session = begin(async () => result({ code: 1, stdout: lines.join("\n") }));
    try {
      writeProject(session.dir);
      await session.edit();
      t.mock.timers.tick(TYPECHECK_DEBOUNCE_MS);
      await settle();
      assert.deepEqual(terminals(session.statuses), ["Type errors found"]);
      assert.equal(session.statuses.includes("Types OK"), false);
      const widget = session.widgets.at(-1) ?? [];
      assert.equal(widget[0], "Type errors:");
      assert.equal(widget.length, TYPECHECK_OUTPUT_LINES + 1);
      assert.deepEqual(widget.slice(1), lines.slice(-TYPECHECK_OUTPUT_LINES));
      assert.equal(widget.includes("L001"), false);
      assert.equal(widget.at(-1), "L200");
      assert.equal(session.calls.length, 1);
    } finally {
      session.restore();
    }
  });

  test("V4 missing compiler does not run and does not install anything", async (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const session = begin(async () => {
      throw new Error("runner must not be called");
    });
    try {
      writeProject(session.dir, "missing");
      await session.edit();
      t.mock.timers.tick(TYPECHECK_DEBOUNCE_MS);
      await settle();
      assert.equal(session.calls.length, 0);
      assert.equal(session.execCalls, 0);
      assert.match(session.statuses.at(-1) ?? "", /Type check did not run: compiler not found/);
      assert.equal(session.statuses.includes("Types OK"), false);
      assert.equal(session.statuses.includes("Running type check..."), false);
    } finally {
      session.restore();
    }
  });

  test("V5 signal and a non-executable compiler do not run", async (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const signaled = begin(async () => result({ code: null, signal: "SIGTERM" }));
    try {
      writeProject(signaled.dir);
      await signaled.edit();
      t.mock.timers.tick(TYPECHECK_DEBOUNCE_MS);
      await settle();
      assert.match(signaled.statuses.at(-1) ?? "", /Type check did not run: signal SIGTERM/);
      assert.equal(signaled.statuses.includes("Types OK"), false);
    } finally {
      signaled.restore();
    }

    const blocked = begin();
    try {
      writeProject(blocked.dir, "not-executable");
      const bin = path.join(blocked.dir, "node_modules", ".bin", "tsc");
      assert.equal(fs.statSync(bin).mode & 0o111, 0);
      await blocked.edit();
      t.mock.timers.tick(TYPECHECK_DEBOUNCE_MS);
      for (let i = 0; i < 50 && !blocked.statuses.some((value) => value.includes("did not run")); i++) {
        await new Promise((resolve) => setImmediate(resolve));
      }
      await settle();
      const status = blocked.statuses.at(-1) ?? "";
      assert.match(status, /Type check did not run:/);
      assert.match(status, /EACCES/);
      assert.equal(blocked.statuses.includes("Types OK"), false);
      assert.equal(blocked.execCalls, 0);
    } finally {
      blocked.restore();
    }
  });

  test("V6 a compiler that outlasts the timeout does not become Types OK", async (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const session = begin((request) => new Promise((resolve) => {
      setTimeout(() => resolve(result({ code: 0, stdout: "late\n" })), request.timeoutMs + 1000);
    }));
    try {
      writeProject(session.dir);
      await session.edit();
      t.mock.timers.tick(TYPECHECK_DEBOUNCE_MS);
      await settle();
      assert.equal(session.calls.length, 1);
      assert.equal(session.calls[0].timeoutMs, TYPECHECK_TIMEOUT_MS);
      t.mock.timers.tick(TYPECHECK_TIMEOUT_MS);
      await settle();
      assert.match(session.statuses.at(-1) ?? "", /Type check did not run: timeout/);
      assert.equal(session.statuses.includes("Types OK"), false);
      t.mock.timers.tick(1000);
      await settle();
      assert.equal(session.statuses.includes("Types OK"), false);
      assert.match(session.statuses.at(-1) ?? "", /Type check did not run: timeout/);
    } finally {
      session.restore();
    }
  });

  test("V7 a directory named with space is checked in place", async (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "typecheck-hook-"));
    const dir = path.join(root, "with space");
    fs.mkdirSync(dir);
    const session = begin(async () => result({ code: 2, stdout: "error TS2322: bad\n" }));
    try {
      writeProject(dir);
      session.retarget(dir);
      await session.edit();
      t.mock.timers.tick(TYPECHECK_DEBOUNCE_MS);
      await settle();
      assert.equal(session.calls.length, 1);
      assert.equal(session.calls[0].cwd, dir);
      assert.equal(session.calls[0].command, path.join(dir, "node_modules", ".bin", "tsc"));
      assert.deepEqual(session.calls[0].args, ["--noEmit", "--pretty"]);
      assert.equal(session.calls[0].command.includes(" "), true);
      assert.deepEqual(terminals(session.statuses), ["Type errors found"]);
      assert.equal(session.statuses.includes("Types OK"), false);
    } finally {
      session.restore();
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test("V8 five requests inside the debounce window start one check after the last request", async (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    let seenRequests = 0;
    let requestsAtStart = 0;
    const session = begin(async () => {
      requestsAtStart = seenRequests;
      return result({ code: 0 });
    });
    try {
      writeProject(session.dir);
      for (let i = 0; i < 5; i++) {
        seenRequests += 1;
        await session.edit(`f${i}.ts`);
        t.mock.timers.tick(100);
        await settle();
      }
      assert.equal(session.calls.length, 0);
      t.mock.timers.tick(TYPECHECK_DEBOUNCE_MS);
      await settle();
      assert.equal(session.calls.length, 1);
      assert.equal(requestsAtStart, 5);
      t.mock.timers.tick(TYPECHECK_DEBOUNCE_MS);
      await settle();
      assert.equal(session.calls.length, 1);
    } finally {
      session.restore();
    }
  });

  test("V9 requests during a running check cause one follow-up", async (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    let release: (value: CompilerResult) => void = () => {};
    let calls = 0;
    const session = begin(() => {
      calls += 1;
      if (calls === 1) {
        return new Promise((resolve) => {
          release = resolve;
        });
      }
      return Promise.resolve(result({ code: 0, stdout: "clean\n" }));
    });
    try {
      writeProject(session.dir);
      await session.edit("first.ts");
      t.mock.timers.tick(TYPECHECK_DEBOUNCE_MS);
      await settle();
      assert.equal(calls, 1);
      await session.edit("second.ts");
      await session.edit("third.ts");
      await session.edit("fourth.ts");
      release(result({ code: 2, stdout: "error TS2322: bad\n" }));
      await settle();
      assert.equal(calls, 1);
      t.mock.timers.tick(1);
      await settle();
      assert.equal(calls, 2);
      assert.equal(session.statuses.includes("Type errors found"), true);
      assert.equal(session.statuses.includes("Types OK"), true);
      t.mock.timers.tick(TYPECHECK_TIMEOUT_MS);
      await settle();
      assert.equal(calls, 2);
    } finally {
      session.restore();
    }
  });

  test("V10 a directory without tsconfig reports nothing and runs nothing", async (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const session = begin(async () => result({ code: 0 }));
    try {
      fs.writeFileSync(path.join(session.dir, "a.ts"), "export const value = 1;\n");
      await session.edit();
      t.mock.timers.tick(TYPECHECK_DEBOUNCE_MS);
      await settle();
      t.mock.timers.tick(TYPECHECK_TIMEOUT_MS);
      await settle();
      assert.equal(session.calls.length, 0);
      assert.deepEqual(session.statuses, []);
      assert.deepEqual(session.widgets, []);
    } finally {
      session.restore();
    }
  });

  test("a seeded sequence never goes idle with an unserved request or reports ok for a failed run", async (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const rand = mulberry32(20261006);
    const queued: Array<() => void> = [];
    const planned: CompilerResult[] = [];
    let requests = 0;
    let requestsAtLastStart = 0;
    const choose = (): CompilerResult => {
      const roll = rand();
      if (roll < 0.25) return result({ code: 0, stdout: "clean\n" });
      if (roll < 0.5) return result({ code: 2, stdout: "error TS2322: bad\n" });
      if (roll < 0.75) return result({ code: null, signal: "SIGTERM" });
      return result({ code: 0, timedOut: true });
    };
    const session = begin(() => {
      requestsAtLastStart = requests;
      const value = choose();
      planned.push(value);
      if (rand() < 0.4) {
        return new Promise((resolve) => queued.push(() => resolve(value)));
      }
      return Promise.resolve(value);
    });
    try {
      writeProject(session.dir);
      for (let step = 0; step < 24; step++) {
        const action = rand();
        if (action < 0.6) {
          requests += 1;
          await session.edit(`s${step}.ts`);
        } else if (queued.length > 0 && action < 0.85) {
          queued.shift()?.();
        } else {
          t.mock.timers.tick(Math.floor(rand() * 500));
        }
        await settle();
      }
      for (let drain = 0; drain < 30; drain++) {
        while (queued.length > 0) {
          queued.shift()?.();
          await settle();
        }
        t.mock.timers.tick(TYPECHECK_DEBOUNCE_MS);
        await settle();
        t.mock.timers.tick(1);
        await settle();
      }
      assert.equal(queued.length, 0);
      assert.equal(requestsAtLastStart, requests);
      const reported = terminals(session.statuses);
      assert.equal(reported.length, planned.length);
      for (let i = 0; i < planned.length; i++) assert.equal(reported[i], expectedStatus(planned[i]));
      assert.equal(session.execCalls, 0);
    } finally {
      session.restore();
    }
  });
});
