/**
 * Offline check for the invalidation budget in agent/EXTENSIONS.md.
 * One before_agent_start replay, then a count of hook rows whose bytes changed.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import boundsExtension from "../extensions/bounds.ts";
import memoryGateExtension from "../extensions/memory-gate.ts";
import readGuardExtension from "../extensions/read-guard.ts";
import recapExtension from "../extensions/recap.ts";
import { beginUserTurn, resetTelemetryForTests, setOpenNote } from "./telemetry.ts";

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

export function maxPrefixInvalidations(contractPath: string): number {
  const text = fs.readFileSync(contractPath, "utf8");
  const match = text.match(/Maximum prefix invalidation points per turn:\s*(\d+)/);
  if (!match) throw new Error("agent/EXTENSIONS.md does not declare the invalidation maximum");
  return Number(match[1]);
}

type HookHandler = (event: Record<string, unknown>, ctx: Record<string, unknown>) => unknown;

function fakePi(handlers: Map<string, HookHandler[]>) {
  return {
    on(event: string, handler: HookHandler) {
      const list = handlers.get(event) ?? [];
      list.push(handler);
      handlers.set(event, list);
    },
    appendEntry() {},
    registerTool() {},
    registerCommand() {},
    registerShortcut() {},
    getActiveTools() {
      return [];
    },
    setActiveTools() {},
    sendMessage() {},
    setModel: async () => true,
    setThinkingLevel() {},
  };
}

/**
 * Pi's runner reads each extension's handler list through Map.get inside
 * snapshotEventHandlers. The telemetry patch records a row only on that read.
 */
function snapshotEventHandlers(handlers: Map<string, HookHandler[]>, event: string): HookHandler[] {
  return (handlers.get(event) ?? []).slice();
}

/** Loads the section writers in the measured order and returns how many hook rows changed bytes. */
export async function replaySectionTrace(): Promise<number> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-build-hooks-"));
  fs.writeFileSync(path.join(dir, "AGENTS.md"), "# test\n");
  const notes = path.join(dir, ".agent", "notes");
  fs.mkdirSync(notes, { recursive: true });
  fs.writeFileSync(path.join(notes, "INDEX.md"), INDEX);
  const settings = path.join(dir, "settings.json");
  fs.writeFileSync(
    settings,
    JSON.stringify({
      memoryGate: { enabled: true, autoScaffold: false, injectIndexOnSessionStart: true, blockRawNotesReads: false },
      recap: { enabled: true },
      readGuard: { enabled: true },
      bounds: { enabled: true },
      routing: { enabled: false, tiers: { escalate: "provider/model" } },
    }),
  );
  const dbPath = path.join(dir, "telemetry.db");
  const previousSettings = process.env.PI_BUILD_SETTINGS;
  const previousDb = process.env.PI_BUILD_TELEMETRY_DB;
  process.env.PI_BUILD_SETTINGS = settings;
  process.env.PI_BUILD_TELEMETRY_DB = dbPath;
  resetTelemetryForTests();
  try {
    const handlers = new Map<string, HookHandler[]>();
    await boundsExtension(fakePi(handlers) as never);
    await memoryGateExtension(fakePi(handlers) as never);
    readGuardExtension(fakePi(handlers) as never);
    recapExtension(fakePi(handlers) as never);
    beginUserTurn("sess", "same prompt");
    setOpenNote({
      path: path.join(dir, "note.md"),
      topic: "t",
      currentClaim: "the harness keeps the claim",
      preCommitted: [{ if: "tests fail", then: "revert" }],
    });
    const payload = { prompt: "same prompt", systemPromptOptions: { sections: {} as Record<string, string> } };
    const ctx = { cwd: dir, sessionManager: { getSessionId: () => "sess" } };
    for (const handler of snapshotEventHandlers(handlers, "before_agent_start")) {
      await handler(payload, ctx);
    }
    const db = new DatabaseSync(dbPath, { readOnly: true });
    const row = db
      .prepare(
        `SELECT COUNT(*) AS n FROM hook_touches
         WHERE bytes_before != bytes_after
           AND event IN ('before_agent_start', 'context', 'context_with_system', 'session_before_compact', 'session_compact')`,
      )
      .get() as { n: number };
    db.close();
    return Number(row.n);
  } finally {
    if (previousSettings === undefined) delete process.env.PI_BUILD_SETTINGS;
    else process.env.PI_BUILD_SETTINGS = previousSettings;
    if (previousDb === undefined) delete process.env.PI_BUILD_TELEMETRY_DB;
    else process.env.PI_BUILD_TELEMETRY_DB = previousDb;
    resetTelemetryForTests();
  }
}

function contractPath(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../agent/EXTENSIONS.md");
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const max = maxPrefixInvalidations(contractPath());
  const points = await replaySectionTrace();
  if (points > max) {
    console.error(`FAIL: hook trace has ${points} invalidation points, maximum is ${max}`);
    process.exit(1);
  }
  console.log(`ok: hook trace ${points} invalidation points, maximum ${max}`);
}
