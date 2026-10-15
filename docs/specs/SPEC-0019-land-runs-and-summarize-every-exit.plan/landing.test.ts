import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, realpathSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { landReviewBranch } from "../../../lib/pipeline.ts";

const git = (target: string, ...args: string[]): string => execFileSync("git", ["-C", target, ...args],
  { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();

function fixture(t: any) {
  const target = realpathSync(mkdtempSync(join(tmpdir(), "spec19-plan-land-")));
  t.after(() => rmSync(target, { recursive: true, force: true }));
  git(target, "init", "-q", "-b", "main");
  git(target, "config", "user.name", "Test");
  git(target, "config", "user.email", "test@example.invalid");
  writeFileSync(join(target, "changed.txt"), "base\n");
  writeFileSync(join(target, "local.txt"), "original\n");
  git(target, "add", "."); git(target, "commit", "-qm", "base");
  const base = git(target, "rev-parse", "HEAD");
  git(target, "checkout", "-qb", "review");
  writeFileSync(join(target, "changed.txt"), "review\n");
  git(target, "commit", "-qam", "review work");
  const tip = git(target, "rev-parse", "HEAD");
  git(target, "checkout", "-q", "main");
  return { target, base, tip, branch: "review", baseBranch: "main", enabled: true };
}

test("landing is a fast-forward, deletes the review branch and preserves unrelated tracked and untracked edits", (t) => {
  const r = fixture(t);
  writeFileSync(join(r.target, "notes.txt"), "mine\n");
  writeFileSync(join(r.target, "local.txt"), "tracked local edit\n");
  const result = landReviewBranch(r);
  assert.equal(result.landed, true, result.reason);
  assert.equal(result.onto, "main");
  assert.equal(git(r.target, "rev-parse", "HEAD"), r.tip);
  assert.equal(git(r.target, "branch", "--list", "review"), "");
  assert.equal(git(r.target, "rev-list", "--count", "HEAD"), "2");
  assert.equal(git(r.target, "rev-list", "--merges", "--count", "HEAD"), "0");
  assert.equal(readFileSync(join(r.target, "notes.txt"), "utf8"), "mine\n");
  assert.equal(readFileSync(join(r.target, "local.txt"), "utf8"), "tracked local edit\n");
});

test("refusals follow disabled/detached/switched/moved/fast-forward order and keep refs, index and edits", (t) => {
  for (const mode of ["disabled", "detached", "switched", "moved", "conflict"] as const) {
    const r = fixture(t);
    let input: Parameters<typeof landReviewBranch>[0] = r;
    if (mode === "disabled") input = { ...r, enabled: false, baseBranch: null };
    if (mode === "detached") input = { ...r, baseBranch: null };
    if (mode === "switched") git(r.target, "checkout", "-qb", "other");
    if (mode === "moved") {
      writeFileSync(join(r.target, "other.txt"), "moved\n");
      git(r.target, "add", "."); git(r.target, "commit", "-qm", "move base");
    }
    if (mode === "conflict") writeFileSync(join(r.target, "changed.txt"), "uncommitted conflict\n");
    const refs = git(r.target, "show-ref");
    const status = git(r.target, "status", "--porcelain");
    const index = git(r.target, "write-tree");
    const contents = readFileSync(join(r.target, "changed.txt"), "utf8");
    const result = landReviewBranch(input);
    assert.equal(result.landed, false, mode);
    assert.match(result.reason, mode === "switched" ? /other/ : mode === "conflict" ? /fast-forward/ : new RegExp(mode));
    if (mode === "conflict") assert.match(result.reason, /error|overwritten|local changes/i, "include git's error");
    assert.equal(git(r.target, "show-ref"), refs, mode);
    assert.equal(git(r.target, "status", "--porcelain"), status, mode);
    assert.equal(git(r.target, "write-tree"), index, mode);
    assert.equal(readFileSync(join(r.target, "changed.txt"), "utf8"), contents, mode);
    assert.equal(git(r.target, "rev-parse", "review"), r.tip, mode);
  }
});

test("a target now detached is a switched-target refusal without moving either branch", (t) => {
  const r = fixture(t);
  git(r.target, "checkout", "-q", "--detach", r.base);
  const refs = git(r.target, "show-ref");
  const result = landReviewBranch(r);
  assert.equal(result.landed, false);
  assert.match(result.reason, /detached|HEAD/i);
  assert.equal(git(r.target, "show-ref"), refs);
});
