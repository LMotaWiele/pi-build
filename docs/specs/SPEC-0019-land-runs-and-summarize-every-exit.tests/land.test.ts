import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { landReviewBranch } from "../../../lib/pipeline.ts";

const git = (cwd: string, ...args: string[]) => execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();

// main at base; a review branch one commit ahead of it.
function repo(t: any) {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "spec19-land-")));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  git(dir, "init", "-q", "-b", "main");
  git(dir, "config", "user.email", "t@t"); git(dir, "config", "user.name", "t");
  fs.writeFileSync(path.join(dir, "a.txt"), "a\n");
  git(dir, "add", "."); git(dir, "commit", "-q", "-m", "base");
  const base = git(dir, "rev-parse", "HEAD");
  git(dir, "branch", "review");
  git(dir, "checkout", "-q", "review");
  fs.writeFileSync(path.join(dir, "a.txt"), "a\nb\n");
  git(dir, "commit", "-q", "-am", "work");
  const tip = git(dir, "rev-parse", "HEAD");
  git(dir, "checkout", "-q", "main");
  return { dir, base, tip };
}

test("when the branch it started on has not moved, the run fast-forwards it and drops the review branch", (t) => {
  const { dir, base, tip } = repo(t);
  const r = landReviewBranch({ target: dir, branch: "review", base, baseBranch: "main", enabled: true });
  assert.equal(r.landed, true, r.reason);
  assert.equal(r.onto, "main");
  assert.equal(git(dir, "rev-parse", "main"), tip);
  assert.equal(git(dir, "branch", "--list", "review"), "");
  assert.equal(git(dir, "rev-list", "--merges", "--count", "main"), "0", "no merge commit");
});

test("uncommitted edits to other files survive the fast-forward", (t) => {
  const { dir, base, tip } = repo(t);
  fs.writeFileSync(path.join(dir, "notes.md"), "mine\n");
  const r = landReviewBranch({ target: dir, branch: "review", base, baseBranch: "main", enabled: true });
  assert.equal(r.landed, true, r.reason);
  assert.equal(git(dir, "rev-parse", "main"), tip);
  assert.equal(fs.readFileSync(path.join(dir, "notes.md"), "utf8"), "mine\n");
});

test("a moved branch, another checked-out branch, a detached start, a conflicting edit or landing disabled keep the review branch", (t) => {
  const cases: Array<[string, (r: ReturnType<typeof repo>) => Parameters<typeof landReviewBranch>[0], RegExp]> = [
    ["moved", (r) => {
      fs.writeFileSync(path.join(r.dir, "c.txt"), "c\n"); git(r.dir, "add", "."); git(r.dir, "commit", "-q", "-m", "moved");
      return { target: r.dir, branch: "review", base: r.base, baseBranch: "main", enabled: true };
    }, /moved/],
    ["switched", (r) => {
      git(r.dir, "checkout", "-q", "-b", "other");
      return { target: r.dir, branch: "review", base: r.base, baseBranch: "main", enabled: true };
    }, /other/],
    ["detached", (r) => ({ target: r.dir, branch: "review", base: r.base, baseBranch: null, enabled: true }), /detached/],
    ["conflict", (r) => {
      fs.writeFileSync(path.join(r.dir, "a.txt"), "local edit\n");
      return { target: r.dir, branch: "review", base: r.base, baseBranch: "main", enabled: true };
    }, /fast-forward/],
    ["disabled", (r) => ({ target: r.dir, branch: "review", base: r.base, baseBranch: "main", enabled: false }), /disabled/],
  ];
  for (const [name, arrange, reason] of cases) {
    const r = repo(t);
    const input = arrange(r);
    const before = git(r.dir, "rev-parse", "main");
    const result = landReviewBranch(input);
    assert.equal(result.landed, false, name);
    assert.match(result.reason, reason, `${name}: ${result.reason}`);
    assert.equal(git(r.dir, "rev-parse", "review"), r.tip, `${name}: review branch kept`);
    assert.equal(git(r.dir, "rev-parse", "main"), before, `${name}: main untouched`);
  }
});
