import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  defaultToolDir,
  mapCommand,
  mapSettings,
  SingleFlight,
  touchesProject,
  type Runner,
} from "../extensions/map.ts";
import { scaffoldProject, validateProject } from "../lib/scaffold.ts";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("map settings default and the command names the project, ledger, window, and turn", () => {
  const settings = mapSettings({}, "/tools/map");
  assert.deepEqual(settings, { outDir: ".agent/map", windowDays: 7, uv: "uv", toolDir: "/tools/map" });
  const command = mapCommand(settings, { root: "/work/p", telemetry: "/db/telemetry.db", turn: "t-1" });
  assert.equal(command.bin, "uv");
  assert.deepEqual(command.args, [
    "run", "--project", "/tools/map", "python", "-m", "map_build",
    "--repo", "/work/p",
    "--out", "/work/p/.agent/map",
    "--telemetry", "/db/telemetry.db",
    "--window-days", "7",
    "--turn", "t-1",
  ]);
  const custom = mapSettings({ outDir: "out/map", windowDays: 3, uv: "/opt/uv", toolDir: "/x" });
  const noTurn = mapCommand(custom, { root: "/p", telemetry: "/t.db" });
  assert.equal(noTurn.bin, "/opt/uv");
  assert.equal(noTurn.args.includes("--turn"), false);
  assert.equal(noTurn.args[noTurn.args.indexOf("--out") + 1], "/p/out/map");
  assert.equal(noTurn.args[noTurn.args.indexOf("--window-days") + 1], "3");
  assert.equal(mapSettings({ windowDays: -1 }).windowDays, 7);
});

test("the default tool dir is tools/map beside the real extension file", () => {
  assert.equal(defaultToolDir(path.join(repo, "extensions", "map.ts")), path.join(repo, "tools", "map"));
  const linkDir = fs.mkdtempSync(path.join(os.tmpdir(), "map-link-"));
  const link = path.join(linkDir, "extensions");
  fs.symlinkSync(path.join(repo, "extensions"), link);
  assert.equal(defaultToolDir(path.join(link, "map.ts")), path.join(repo, "tools", "map"));
  assert.equal(fs.existsSync(path.join(defaultToolDir(), "pyproject.toml")), true);
});

test("only paths inside the project start a build", () => {
  assert.equal(touchesProject(["src/a.ts"], "/p"), true);
  assert.equal(touchesProject(["/p/src/a.ts"], "/p"), true);
  assert.equal(touchesProject(["/elsewhere/a.ts", "../outside.md"], "/p"), false);
  assert.equal(touchesProject(["/pp/a.ts"], "/p"), false);
  assert.equal(touchesProject([], "/p"), false);
});

test("single flight: one build at a time, a request during a build runs once more", async () => {
  const started: string[] = [];
  const releases: (() => void)[] = [];
  const runner: Runner = (command) =>
    new Promise((resolve) => {
      started.push(command.args.join(" "));
      releases.push(() => resolve(0));
    });
  const flight = new SingleFlight(runner);
  const first = flight.request({ bin: "uv", args: ["a"] }, "/p");
  assert.equal(flight.busy, true);
  flight.request({ bin: "uv", args: ["b"] }, "/p");
  const third = flight.request({ bin: "uv", args: ["c"] }, "/p");
  assert.deepEqual(started, ["a"]);
  releases.shift()!();
  await new Promise((r) => setImmediate(r));
  assert.deepEqual(started, ["a", "c"]); // b and c coalesce into one follow-up with the latest command
  releases.shift()!();
  await first;
  await third;
  assert.equal(flight.busy, false);
  assert.equal(flight.runs, 2);
  const again = flight.request({ bin: "uv", args: ["d"] }, "/p");
  releases.shift()!();
  await again;
  assert.deepEqual(started, ["a", "c", "d"]);
});

test("a failing build does not wedge the queue", async () => {
  let calls = 0;
  const flight = new SingleFlight(async () => {
    calls += 1;
    throw new Error("boom");
  });
  const original = console.error;
  console.error = () => undefined;
  try {
    await flight.request({ bin: "uv", args: [] }, "/p");
    await flight.request({ bin: "uv", args: [] }, "/p");
  } finally {
    console.error = original;
  }
  assert.equal(calls, 2);
  assert.equal(flight.busy, false);
});

test("validation skips .agent/map and still checks the rest of .agent", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "map-validate-"));
  scaffoldProject(dir);
  assert.equal(validateProject(dir).ok, true, validateProject(dir).lines.join("\n"));
  fs.mkdirSync(path.join(dir, ".agent/map/data"), { recursive: true });
  fs.writeFileSync(path.join(dir, ".agent/map/data/meta.json"), '{"repo": "/home/me/pi-build"}\n');
  fs.writeFileSync(path.join(dir, ".agent/map/index.html"), "<p>pi-build map</p>\n");
  const withMap = validateProject(dir);
  assert.equal(withMap.ok, true, withMap.lines.join("\n"));
  fs.mkdirSync(path.join(dir, ".agent/mapping"), { recursive: true });
  fs.writeFileSync(path.join(dir, ".agent/mapping/note.md"), "pi-build\n");
  const elsewhere = validateProject(dir);
  assert.equal(elsewhere.ok, false);
  assert.match(elsewhere.lines.join("\n"), /harness name in \.agent\/mapping\/note\.md/);
});
