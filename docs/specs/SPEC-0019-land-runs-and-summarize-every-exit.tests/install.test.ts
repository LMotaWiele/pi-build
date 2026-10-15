import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { installSpec } from "../../../lib/install-spec.ts";

const git = (cwd: string, ...args: string[]) => execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const SPEC = (id: string, title = "Wire the thing") =>
  `# SPEC-${id}: ${title}\n\n| Field | Value |\n|---|---|\n| Status | ready |\n\nParent of nothing. Refers to SPEC-${id} by name.\n\n## 8. Verification\n| O | C | Check ID: condition |\n|---|---|---|\n| O1 | §6.1 | V1: a |\n`;
const INDEX = "# Specifications\n\n| ID | Title | Status | Implemented by | Date first added | Former path |\n|---|---|---|---|---|---|\n" +
  "| 0007 | SPEC-0007: Seven | implemented | pi | 2026-09-26 | — |\n| 0012 | SPEC-0012: Twelve | implemented | pi | 2026-09-22 | — |\n";

function tmp(t: any, prefix: string): string {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

function repo(t: any, opts: { index?: boolean } = {}): string {
  const dir = tmp(t, "spec19-install-");
  git(dir, "init", "-q", "-b", "main");
  git(dir, "config", "user.email", "t@t"); git(dir, "config", "user.name", "t");
  fs.mkdirSync(path.join(dir, "docs/specs"), { recursive: true });
  fs.writeFileSync(path.join(dir, "docs/specs/SPEC-0007-seven.md"), SPEC("0007", "Seven"));
  fs.writeFileSync(path.join(dir, "docs/specs/SPEC-0012-twelve.md"), SPEC("0012", "Twelve"));
  if (opts.index !== false) fs.writeFileSync(path.join(dir, "docs/specs/index.md"), INDEX);
  git(dir, "add", "."); git(dir, "commit", "-q", "-m", "base");
  return dir;
}

// Build a zip with python3's zipfile; entries are { name: content }.
function zip(t: any, entries: Record<string, string>): string {
  const dir = tmp(t, "spec19-zip-");
  const file = path.join(dir, "download.zip");
  execFileSync("python3", ["-c",
    "import sys, json, zipfile\nz = zipfile.ZipFile(sys.argv[1], 'w', zipfile.ZIP_DEFLATED)\nfor k, v in json.loads(sys.argv[2]).items(): z.writestr(k, v)\nz.close()",
    file, JSON.stringify(entries)]);
  return file;
}

const read = (repoDir: string, rel: string) => fs.readFileSync(path.join(repoDir, rel), "utf8");
const commits = (repoDir: string) => Number(git(repoDir, "rev-list", "--count", "HEAD"));

test("a downloaded zip with a SPEC-NNNN spec and its tests gets the next free ID, an index row and one commit of just those paths", (t) => {
  const dir = repo(t);
  fs.writeFileSync(path.join(dir, "scratch.txt"), "mine\n");
  const source = zip(t, {
    "docs/specs/SPEC-NNNN-wire-the-thing.md": SPEC("NNNN"),
    "docs/specs/SPEC-NNNN-wire-the-thing.tests/a.test.ts": "// SPEC-NNNN\n",
  });
  const r = installSpec({ target: dir, source, today: "2026-10-15" });
  assert.ok(r.ok, !r.ok ? r.error : "");
  if (!r.ok) return;
  assert.equal(r.id, "0013");
  assert.equal(r.spec, "docs/specs/SPEC-0013-wire-the-thing.md");
  assert.equal(r.tests, "docs/specs/SPEC-0013-wire-the-thing.tests");
  assert.equal(r.committed, true);
  assert.match(read(dir, r.spec), /^# SPEC-0013: Wire the thing/);
  assert.ok(!read(dir, r.spec).includes("SPEC-NNNN"));
  assert.equal(read(dir, "docs/specs/SPEC-0013-wire-the-thing.tests/a.test.ts"), "// SPEC-0013\n");
  assert.ok(read(dir, "docs/specs/index.md").includes("| 0013 | SPEC-0013: Wire the thing | ready | — | 2026-10-15 | — |"));
  assert.equal(git(dir, "status", "--porcelain"), "?? scratch.txt", "only the install was committed");
  assert.deepEqual(git(dir, "show", "--name-only", "--format=", "HEAD").split("\n").sort(), [
    "docs/specs/SPEC-0013-wire-the-thing.md", "docs/specs/SPEC-0013-wire-the-thing.tests/a.test.ts", "docs/specs/index.md",
  ]);
});

test("a zip with files at its root and an explicit ID keeps that ID", (t) => {
  const dir = repo(t);
  const source = zip(t, { "SPEC-0019-land.md": SPEC("0019", "Land"), "SPEC-0019-land.tests/b.test.ts": "" });
  const r = installSpec({ target: dir, source, today: "2026-10-15" });
  assert.ok(r.ok && r.id === "0019", JSON.stringify(r));
  assert.ok(fs.existsSync(path.join(dir, "docs/specs/SPEC-0019-land.tests/b.test.ts")));
});

test("a single .md brings its sibling .tests directory along", (t) => {
  const dir = repo(t);
  const downloads = tmp(t, "spec19-dl-");
  fs.writeFileSync(path.join(downloads, "SPEC-NNNN-solo.md"), SPEC("NNNN", "Solo"));
  fs.mkdirSync(path.join(downloads, "SPEC-NNNN-solo.tests"));
  fs.writeFileSync(path.join(downloads, "SPEC-NNNN-solo.tests", "c.test.ts"), "");
  const r = installSpec({ target: dir, source: path.join(downloads, "SPEC-NNNN-solo.md"), today: "2026-10-15" });
  assert.ok(r.ok && r.id === "0013", JSON.stringify(r));
  assert.ok(fs.existsSync(path.join(dir, "docs/specs/SPEC-0013-solo.tests/c.test.ts")));
});

test("reinstalling a revised spec under the same ID and slug replaces it and its tests without a second index row", (t) => {
  const dir = repo(t);
  const first = installSpec({ target: dir, source: zip(t, { "SPEC-0019-land.md": SPEC("0019", "Land"), "SPEC-0019-land.tests/old.test.ts": "" }), today: "2026-10-15" });
  assert.ok(first.ok);
  const before = commits(dir);
  const second = installSpec({ target: dir, source: zip(t, { "SPEC-0019-land.md": SPEC("0019", "Land, revised"), "SPEC-0019-land.tests/new.test.ts": "" }), today: "2026-10-16" });
  assert.ok(second.ok && second.committed, JSON.stringify(second));
  assert.equal(commits(dir), before + 1);
  assert.match(read(dir, "docs/specs/SPEC-0019-land.md"), /Land, revised/);
  assert.ok(!fs.existsSync(path.join(dir, "docs/specs/SPEC-0019-land.tests/old.test.ts")));
  assert.ok(fs.existsSync(path.join(dir, "docs/specs/SPEC-0019-land.tests/new.test.ts")));
  assert.equal(read(dir, "docs/specs/index.md").split("\n").filter((l) => l.startsWith("| 0019 ")).length, 1);
  const same = installSpec({ target: dir, source: zip(t, { "SPEC-0019-land.md": SPEC("0019", "Land, revised"), "SPEC-0019-land.tests/new.test.ts": "" }), today: "2026-10-17" });
  assert.ok(same.ok && same.committed === false, JSON.stringify(same));
  assert.equal(commits(dir), before + 1, "an identical reinstall commits nothing");
});

test("an ID already used by another spec, or an archive without exactly one spec, is refused and nothing changes", (t) => {
  const dir = repo(t);
  const head = git(dir, "rev-parse", "HEAD");
  const clash = installSpec({ target: dir, source: zip(t, { "SPEC-0012-other.md": SPEC("0012") }), today: "2026-10-15" });
  assert.equal(clash.ok, false);
  if (!clash.ok) assert.match(clash.error, /0012/);
  const none = installSpec({ target: dir, source: zip(t, { "README.md": "x" }), today: "2026-10-15" });
  assert.equal(none.ok, false);
  const two = installSpec({ target: dir, source: zip(t, { "SPEC-NNNN-a.md": SPEC("NNNN"), "SPEC-NNNN-b.md": SPEC("NNNN") }), today: "2026-10-15" });
  assert.equal(two.ok, false);
  assert.equal(git(dir, "rev-parse", "HEAD"), head);
  assert.equal(git(dir, "status", "--porcelain"), "");
});

test("a dry install reports what it would do and writes nothing", (t) => {
  const dir = repo(t);
  const head = git(dir, "rev-parse", "HEAD");
  const r = installSpec({ target: dir, source: zip(t, { "SPEC-NNNN-x.md": SPEC("NNNN") }), today: "2026-10-15", dryRun: true });
  assert.ok(r.ok && r.id === "0013" && r.committed === false, JSON.stringify(r));
  assert.equal(git(dir, "rev-parse", "HEAD"), head);
  assert.equal(git(dir, "status", "--porcelain"), "");
});

test("a repository without docs/specs or an index gets both", (t) => {
  const dir = tmp(t, "spec19-bare-");
  git(dir, "init", "-q", "-b", "main");
  git(dir, "config", "user.email", "t@t"); git(dir, "config", "user.name", "t");
  fs.writeFileSync(path.join(dir, "README.md"), ""); git(dir, "add", "."); git(dir, "commit", "-q", "-m", "base");
  const r = installSpec({ target: dir, source: zip(t, { "SPEC-NNNN-first.md": SPEC("NNNN", "First"), "SPEC-NNNN-first.tests/a.test.ts": "" }), today: "2026-10-15" });
  assert.ok(r.ok && r.id === "0001", JSON.stringify(r));
  const index = read(dir, "docs/specs/index.md");
  assert.match(index, /\| ID \| Title \| Status \| Implemented by \|/);
  assert.ok(index.includes("| 0001 | SPEC-0001: First | ready | — |"));
});
