// Install a downloaded spec as a path-scoped, pre-run commit. Never reset a ref.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { listSpecs } from "./specs.ts";

export type InstallResult = {
  ok: true;
  id: string;
  slug: string;
  spec: string;
  tests: string | null;
  title: string;
  indexRow: string;
  committed: boolean;
  commit?: string;
} | { ok: false; error: string };

type Entry = { kind: "directory"; mode: number } | { kind: "file"; mode: number; data: Buffer };
type Tree = Map<string, Entry>;

function exists(file: string): boolean {
  try { fs.lstatSync(file); return true; }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

// Reject links rather than following even an apparently safe link: replacing a
// directory must not remove or overwrite somebody else's tree through an alias.
function snapshot(file: string): Tree {
  const tree: Tree = new Map();
  if (!exists(file)) return tree;
  const walk = (absolute: string, relative: string) => {
    const stat = fs.lstatSync(absolute);
    if (stat.isSymbolicLink()) throw new Error(`Symlink is not an install path: ${absolute}`);
    const mode = stat.mode & 0o777;
    if (stat.isFile()) tree.set(relative, { kind: "file", mode, data: fs.readFileSync(absolute) });
    else if (stat.isDirectory()) {
      tree.set(relative, { kind: "directory", mode });
      for (const name of fs.readdirSync(absolute).sort()) walk(path.join(absolute, name), relative ? `${relative}/${name}` : name);
    } else throw new Error(`Not a regular file or directory: ${absolute}`);
  };
  walk(file, "");
  return tree;
}

function checkAncestors(root: string, file: string): void {
  const relative = path.relative(root, file);
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error(`Destination escapes target: ${file}`);
  }
  let current = root;
  for (const part of relative.split(path.sep).slice(0, -1)) {
    current = path.join(current, part);
    if (!exists(current)) continue;
    const stat = fs.lstatSync(current);
    if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error(`Unsafe destination directory: ${current}`);
  }
}

function equalTrees(a: Tree, b: Tree): boolean {
  if (a.size !== b.size) return false;
  for (const [name, entry] of a) {
    const other = b.get(name);
    if (!other || entry.kind !== other.kind || entry.mode !== other.mode) return false;
    if (entry.kind === "file" && (other.kind !== "file" || !entry.data.equals(other.data))) return false;
  }
  return true;
}

function replaceTree(file: string, tree: Tree): void {
  // Unlink before writing; a regular destination file can itself be a hard link.
  fs.rmSync(file, { recursive: true, force: true });
  for (const [relative, entry] of tree) {
    const destination = relative ? path.join(file, relative) : file;
    if (entry.kind === "directory") fs.mkdirSync(destination, { recursive: true, mode: 0o700 });
    else {
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.writeFileSync(destination, entry.data, { mode: entry.mode });
      fs.chmodSync(destination, entry.mode);
    }
  }
  // Apply directory permissions last so read-only source directories work too.
  for (const [relative, entry] of [...tree].reverse()) {
    if (entry.kind === "directory") fs.chmodSync(relative ? path.join(file, relative) : file, entry.mode);
  }
}

function textTree(text: string, mode = 0o644): Tree {
  return new Map([["", { kind: "file", mode, data: Buffer.from(text) }]]);
}

function sourceTree(tree: Tree, id: string, placeholder: boolean): Tree {
  for (const entry of tree.values()) {
    // Preserve executable tests, but don't propagate arbitrary archive permissions.
    entry.mode = entry.kind === "directory" ? 0o755 : entry.mode & 0o111 ? 0o755 : 0o644;
    if (placeholder && entry.kind === "file") {
      const text = entry.data.toString("utf8");
      if (!text.includes("\0") && Buffer.from(text).equals(entry.data)) {
        entry.data = Buffer.from(text.replaceAll("SPEC-NNNN", `SPEC-${id}`));
      }
    }
  }
  return tree;
}

// Validate the *whole* archive before extracting anything. zipfile.extractall
// alone silently normalizes traversal names and does not reject Unix symlinks.
const EXTRACT = String.raw`
import pathlib, re, shutil, stat, sys, zipfile
root = pathlib.Path(sys.argv[2]).resolve()
with zipfile.ZipFile(sys.argv[1]) as archive:
    entries = []
    seen = set()
    for entry in archive.infolist():
        name = entry.orig_filename
        parts = name.rstrip('/').split('/')
        if (not name or '\\' in name or name.startswith('/') or re.match(r'^[A-Za-z]:', name)
                or any(p in ('', '.', '..') for p in parts) or '\x00' in name):
            raise ValueError('Unsafe zip entry: ' + repr(name))
        destination = root.joinpath(*parts)
        if not destination.is_relative_to(root):
            raise ValueError('Zip entry escapes scratch: ' + name)
        mode = entry.external_attr >> 16
        kind = stat.S_IFMT(mode)
        if kind not in (0, stat.S_IFREG, stat.S_IFDIR) or stat.S_ISLNK(mode):
            raise ValueError('Non-regular zip entry: ' + name)
        key = '/'.join(parts)
        if key in seen:
            raise ValueError('Duplicate zip entry: ' + name)
        seen.add(key)
        entries.append((entry, destination, mode))
    files = {str(dst) for entry, dst, mode in entries if not entry.is_dir()}
    for entry, dst, mode in entries:
        if any(str(parent) in files for parent in dst.parents):
            raise ValueError('File used as a zip directory: ' + entry.filename)
    for entry, dst, mode in entries:
        if entry.is_dir():
            dst.mkdir(parents=True, exist_ok=True)
        else:
            dst.parent.mkdir(parents=True, exist_ok=True)
            with archive.open(entry) as source, dst.open('xb') as target:
                shutil.copyfileobj(source, target)
            dst.chmod(0o755 if mode & 0o111 else 0o644)
`;

function cells(line: string): string[] {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim());
}

function errorText(error: unknown): string {
  const stderr = (error as { stderr?: Buffer | string })?.stderr?.toString().trim();
  return stderr || (error instanceof Error ? error.message : String(error));
}

export function installSpec(input: { target: string; source: string; today: string; dryRun?: boolean }): InstallResult {
  let scratch: string | undefined;
  let indexLock: string | undefined;
  let lockFd: number | undefined;
  let originalIndex: Buffer | undefined;
  let indexFile: string | undefined;
  let indexChanged = false;
  let committed = false;
  const changed: { file: string; before: Tree }[] = [];
  const createdDirectories: string[] = [];
  try {
    const target = fs.realpathSync(input.target);
    const gitEnvironment = { ...process.env };
    // The caller's Git context must not redirect a target install into its own
    // repository or index (for example when called from a Git hook).
    for (const key of ["GIT_DIR", "GIT_WORK_TREE", "GIT_COMMON_DIR", "GIT_INDEX_FILE", "GIT_PREFIX"]) delete gitEnvironment[key];
    const git = (args: string[], env?: NodeJS.ProcessEnv) => execFileSync("git", ["-C", target, ...args], {
      encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
      env: { ...gitEnvironment, GIT_LITERAL_PATHSPECS: "1", ...env },
      maxBuffer: 64 * 1024 * 1024,
    });
    const root = fs.realpathSync(git(["rev-parse", "--show-toplevel"]).trim());
    if (root !== target) throw new Error("Install target must be the repository root");
    const source = path.resolve(input.source);
    const extension = path.extname(source);
    if (extension !== ".md" && extension !== ".zip") throw new Error("Source must be a .md or .zip file");
    if (!fs.lstatSync(source).isFile()) throw new Error("Source must be a regular file (not a symlink)");

    scratch = fs.mkdtempSync(path.join(os.tmpdir(), "pi-install-spec-"));
    let candidate: string;
    if (extension === ".zip") {
      const extracted = path.join(scratch, "source");
      fs.mkdirSync(extracted);
      execFileSync("python3", ["-c", EXTRACT, source, extracted], { stdio: ["ignore", "pipe", "pipe"] });
      const candidates: string[] = [];
      for (const directory of [extracted, path.join(extracted, "docs/specs")]) {
        if (!exists(directory)) continue;
        if (!fs.lstatSync(directory).isDirectory()) throw new Error(`Not a source directory: ${directory}`);
        for (const spec of listSpecs(fs.readdirSync(directory))) {
          const file = path.join(directory, spec.file);
          if (fs.lstatSync(file).isFile()) candidates.push(file);
        }
      }
      if (candidates.length !== 1) throw new Error(`Source must contain exactly one spec, found ${candidates.length}`);
      candidate = candidates[0];
    } else candidate = source;
    const selected = listSpecs([path.basename(candidate)]);
    if (selected.length !== 1) throw new Error("Source must contain exactly one SPEC-<ID>-<slug>.md (not a run record)");
    const ref = selected[0];
    const sourceTests = candidate.replace(/\.md$/, ".tests");
    if (exists(sourceTests) && !fs.lstatSync(sourceTests).isDirectory()) throw new Error("Sibling tests must be a regular directory");
    // Read every selected source file now, before any target mutation.
    const rawSpec = snapshot(candidate);
    const rawTests = snapshot(sourceTests);
    const specEntry = rawSpec.get("");
    if (specEntry?.kind !== "file") throw new Error("Spec is not a regular file");

    const specDirectory = path.join(target, "docs/specs");
    const index = path.join(specDirectory, "index.md");
    checkAncestors(target, index);
    const oldIndex = snapshot(index);
    const oldIndexEntry = oldIndex.get("");
    if (oldIndexEntry && oldIndexEntry.kind !== "file") throw new Error("Spec index is not a regular file");
    let indexText = oldIndexEntry?.kind === "file" ? oldIndexEntry.data.toString("utf8") :
      "# Specifications\n\n| ID | Title | Status | Implemented by | Date first added |\n|---|---|---|---|---|\n";
    const indexLines = indexText.split(/\r?\n/);
    const headerPosition = indexLines.findIndex((line) => line.trim().startsWith("|") && cells(line)[0] === "ID");
    if (headerPosition < 0) throw new Error("Spec index has no ID table header");
    const headers = cells(indexLines[headerPosition]);
    if (!headers.includes("Title") || !headers.includes("Status")) throw new Error("Spec index needs Title and Status columns");
    const rows = indexLines.slice(headerPosition + 1).filter((line) => line.trim().startsWith("|") && /^[0-9A-Za-z]+$/.test(cells(line)[0]));
    const existing = listSpecs(exists(specDirectory) ? fs.readdirSync(specDirectory) : []);
    let id = ref.id;
    const placeholder = id === "NNNN";
    if (placeholder) {
      let maximum = 0n;
      for (const value of [...existing.map((spec) => spec.id), ...rows.map((row) => cells(row)[0])]) {
        if (/^\d+$/.test(value) && BigInt(value) > maximum) maximum = BigInt(value);
      }
      id = (maximum + 1n).toString().padStart(4, "0");
    }
    for (const spec of existing) {
      if (spec.id.toLowerCase() === id.toLowerCase() && spec.slug !== ref.slug) {
        throw new Error(`SPEC-${id} is already used by ${spec.slug}`);
      }
    }
    const newSpec = sourceTree(rawSpec, id, placeholder);
    const newTests = sourceTree(rawTests, id, placeholder);
    const testFiles = [...newTests].filter(([, entry]) => entry.kind === "file").map(([name]) => name);
    if ([...newTests.keys()].some((name) => name.split("/").some((part) => part.toLowerCase() === ".git"))) {
      throw new Error("Tests must not contain Git repository metadata");
    }
    const text = (newSpec.get("") as Extract<Entry, { kind: "file" }>).data.toString("utf8");
    const title = text.match(/^#[ \t]+(.+?)(?:[ \t]+#+)?[ \t]*$/m)?.[1]?.trim();
    if (!title) throw new Error("Spec must have an H1 title");
    const header = text.split(/^##\s/m, 1)[0];
    const status = header.match(/^\|\s*Status\s*\|\s*([^|\r\n]+)\|/mi)?.[1]?.trim() || "ready";
    const matchingRows = rows.filter((row) => cells(row)[0].toLowerCase() === id.toLowerCase());
    if (matchingRows.length > 1) throw new Error(`Index contains duplicate rows for SPEC-${id}`);
    const escapeCell = (value: string) => value.replaceAll("|", "\\|");
    const indexRow = matchingRows[0] ?? `| ${headers.map((column) => {
      if (column === "ID") return id;
      if (column === "Title") return escapeCell(title);
      if (column === "Status") return escapeCell(status);
      return column.startsWith("Date") ? input.today : "—";
    }).join(" | ")} |`;
    if (!matchingRows.length) indexText = indexText.replace(/\s*$/, "") + "\n" + indexRow + "\n";

    const stem = `docs/specs/SPEC-${id}-${ref.slug}`;
    const spec = `${stem}.md`;
    const tests = `${stem}.tests`;
    const plans = [
      { relative: spec, after: newSpec },
      { relative: tests, after: newTests },
      { relative: "docs/specs/index.md", after: textTree(indexText, oldIndexEntry?.mode ?? 0o644) },
    ].map((plan) => {
      const file = path.join(target, plan.relative);
      checkAncestors(target, file);
      const before = snapshot(file);
      const entry = before.get("");
      if (entry && entry.kind !== (plan.relative === tests ? "directory" : "file")) {
        throw new Error(`Wrong destination type: ${plan.relative}`);
      }
      return { ...plan, file, before };
    });
    const result: Extract<InstallResult, { ok: true }> = {
      ok: true, id, slug: ref.slug, spec, tests: rawTests.size ? tests : null,
      title, indexRow, committed: false,
    };
    if (input.dryRun) return result;

    // A private index keeps add/commit from sweeping unrelated staged work. Hold
    // the real index lock throughout, so restoring its original bytes on failure
    // also preserves flags, partial staging and unrelated entries exactly.
    indexFile = git(["rev-parse", "--path-format=absolute", "--git-path", "index"]).trim();
    if (exists(indexFile) && !fs.lstatSync(indexFile).isFile()) throw new Error("Git index is not a regular file");
    const lock = `${indexFile}.lock`;
    lockFd = fs.openSync(lock, "wx", 0o600);
    indexLock = lock;
    originalIndex = exists(indexFile) ? fs.readFileSync(indexFile) : undefined;
    const temporaryIndex = path.join(scratch, "index");
    if (originalIndex) fs.writeFileSync(temporaryIndex, originalIndex);
    const env = { GIT_INDEX_FILE: temporaryIndex };
    if (!originalIndex) git(["read-tree", "--empty"], env);
    const head = (() => { try { return git(["rev-parse", "--verify", "HEAD"]).trim(); } catch { return undefined; } })();
    const scope = [spec, tests, "docs/specs/index.md"];
    const stagedScope = git(["ls-files", "-z", "--", ...scope], env).split("\0").filter(Boolean);
    const trackedTests = head ? git(["ls-tree", "-r", "--name-only", head, "--", tests]).length > 0 : false;
    const paths = [spec, ...(testFiles.length || trackedTests ? [tests] : []), "docs/specs/index.md"];
    for (const directory of [path.join(target, "docs"), specDirectory]) {
      if (!exists(directory)) { fs.mkdirSync(directory); createdDirectories.push(directory); }
    }
    for (const plan of plans) {
      if (!equalTrees(plan.before, plan.after)) {
        changed.push({ file: plan.file, before: plan.before });
        replaceTree(plan.file, plan.after);
      }
    }
    // Remove old scoped entries first, including staged-only tests and staged
    // deletions, then add only files that actually exist. Empty, never-tracked
    // test directories are not valid Git pathspecs.
    if (stagedScope.length) git(["update-index", "--force-remove", "--", ...stagedScope], env);
    git(["add", "-A", "--", spec, "docs/specs/index.md", ...(testFiles.length ? [tests] : [])], env);
    const diff = git(["diff", "--cached", "--name-only", ...(head ? [head] : []), "--", ...scope], env);

    // Publish the prepared index before the commit: all fallible file writes
    // precede the ref update. Git uses the private index, so our real-index lock
    // does not interfere with its own path-scoped commit lock.
    indexChanged = true;
    fs.copyFileSync(temporaryIndex, indexFile);
    if (!diff.trim()) return result;
    const messageTitle = title.replace(new RegExp(`^SPEC-${id}\\s*[:—–-]?\\s*`, "i"), "");
    git(["commit", "-m", `Add SPEC-${id}: ${messageTitle}`, "--", ...paths], env);
    committed = true;
    result.committed = true;
    result.commit = git(["rev-parse", "HEAD"]).trim();
    return result;
  } catch (error) {
    // No ref-moving rollback. A successful commit is the transaction boundary;
    // failures before it restore only our destinations and the locked index.
    if (committed) throw error;
    const failures: string[] = [];
    for (const entry of changed.reverse()) {
      try { replaceTree(entry.file, entry.before); } catch (rollbackError) { failures.push(errorText(rollbackError)); }
    }
    for (const directory of createdDirectories.reverse()) {
      try { fs.rmdirSync(directory); } catch (rollbackError) { failures.push(errorText(rollbackError)); }
    }
    if (indexChanged && indexFile) {
      try {
        if (originalIndex) fs.writeFileSync(indexFile, originalIndex);
        else fs.rmSync(indexFile, { force: true });
      } catch (rollbackError) { failures.push(errorText(rollbackError)); }
    }
    return { ok: false, error: errorText(error) + (failures.length ? `; rollback failed: ${failures.join("; ")}` : "") };
  } finally {
    try {
      if (lockFd !== undefined) fs.closeSync(lockFd);
    } finally {
      try {
        if (indexLock) fs.rmSync(indexLock, { force: true });
      } finally {
        if (scratch) fs.rmSync(scratch, { recursive: true, force: true });
      }
    }
  }
}
