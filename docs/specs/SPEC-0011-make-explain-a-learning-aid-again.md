# SPEC-0011: Make explain a learning aid again, for every project, and clear the documentation clutter

| Field | Value |
|---|---|
| Status | implemented |
| Size | staged (2 stages) |
| Kind | build |
| Parent | — |
| Date | 2026-09-29 |
| Checkpoint | continuous, with one restart after Stage 1 |
| Run record | /docs/specs/SPEC-0011-run.md |
| Revision | 2 — 2026-09-29, after the first run stopped at Stage 1's exit |

Replace `NNNN` in this file's name, its `.tests/` and `.reference/` directories and the run record with the next free spec ID — `0011` as of `fcd58fc`. Confirm it is free. The two v0.1 specs moved in Stage 2 take the two IDs after it.

**Revision 2.** The first run stopped because Stage 1 added the validator check for non-walkthrough files in `.agent/explain/`, while the files it rejects are moved only in Stage 2 — so Stage 1's exit could never pass. The check now lands at the end of Stage 2, after the cleanup, and V10 is checked there. Nothing else changed. Keep the uncommitted Stage 1 work except that check; the failing memory-gate test is in scope under V2.

Read `/.agents/notes/index.md` if present. Record the revision you start from and any pre-existing uncommitted changes. Commit at each stage exit, naming this spec and the stage.

## 1. Intent

The README states what explain is for: after an edit turn, a walkthrough **for Lucas** — "it is not a note". It has drifted in three ways.

- **Three writers share `.agent/explain/`.** `explain.ts` writes walkthroughs. `recap.ts` writes session recaps there, because its directory setting is named `explainDir` and defaults to the explain directory. And the `explain_write` tool, whose guideline tells agents to put explanations there and nowhere near notes, has become the only unrestricted place an agent can write — so it is used as a progress log and a home for spec reports.
- **The walkthroughs have lost their reader.** The prompt treats as unfamiliar anything not already in `known.md` and never says who reads the result. `known.md` started empty, so JavaScript basics were explained and recorded, alongside names from this repository. A walkthrough is written for every edit turn, trivial or not; a failed explain run is written as a walkthrough; the day's first file has no turn id; and three of five sections repeat the diff or the run report.
- **The repository carries dead copies.** `docs/reference/` is a snapshot from the old `Documents/pi_build` tree that `docs/README.md` itself says the live process does not load. Every `.reference/` tree under `docs/specs/` duplicates code that has since landed and changed. The two v0.1 specs in `docs/design/` were never indexed.

**This is standard behaviour for every project**, not just this repository (Lucas's decision). Most of it is harness code that every session loads. Four parts are not, and this spec covers them: the scaffold template instructs agents to write walkthroughs into `.agent/explain/` by hand; `known.md` is kept per project though the reader is one person; the reader would be hardcoded in a harness that is MIT-licensed; and only this repository's own tests would check the directory rules.

Outcomes:
- **O1**: A walkthrough is written only when an edit turn uses unfamiliar surface for its reader. It has two sections, is named by its turn id, and is never written inside a pipeline run or for a failed explain call.
- **O2**: `known.md` holds only what was genuinely unfamiliar and was explained: no language basics, no names from this repository.
- **O3**: One writer per directory. `explain_write` is gone; progress goes in run records and commit messages; recaps live in `.agent/recaps/`.
- **O4**: Every report is in its spec's run record, both v0.1 specs are indexed, and the stale snapshot and landed reference trees are gone.
- **O5**: Every project gets the same rules: new projects are never told to write explanations by hand; `doctor.sh --project` flags a non-walkthrough in `.agent/explain/` in any project; the known list is one per reader, shared across projects; the reader is host configuration.

## 2. Priority

Walkthroughs are how Lucas learns the code the harnesses write for him, and every pipeline run currently multiplies the noise. Deferred: rewriting existing walkthroughs into the new format; the map follow-up to `SPEC-0007`.

## 3. Prior art

The design intent is the README's own. Progress now has a home it did not have when `explain_write` was added: the run record in `/docs/specs/`, used by every spec since `SPEC-0009`.

## 4. Grounding

| Fact | Expected | Tag | Source |
|---|---|---|---|
| Explain prompt | defines unfamiliar as "not already in known.md"; no reader; five sections; `known:` lines parsed anywhere in the body | measured | `extensions/explain.ts` at `fcd58fc` |
| Walkthrough file name | `explainWriteName("turn", day)`, with `-<Date.now()>` only on collision | measured | same |
| Explain failure | writes "Explanation subagent failed: …" as the walkthrough | measured | same |
| `shouldExplain` | `files.length > 0` only | measured | same |
| Recap directory | settings key `recap.explainDir`, default `.agent/explain` | measured | `extensions/recap.ts` |
| `explain_write` | a tool in `extensions/memory-gate.ts`, named in its prompt text and in the README; `explainWriteName` in `lib/markdown.ts`, tested in `tests/markdown.test.ts` | measured | same |
| Neutrality exemptions | `.agent/map/`, and the harness's own repository, from `SPEC-0010` | measured | `lib/scaffold.ts` |
| `docs/reference/` | five files copied from the old tree, all differing from their live counterparts; referred to only in prose | measured | `docs/README.md`, `cmp` |
| `docs/design/` | `build-spec-pi-v0.1.md` and `fix-spec-pi-v0.1-interop.md`, added 2026-09-22, not in the index | measured | `git log` |
| Code importing from any `.reference/` tree | none | measured | `grep` |
| `.reference/` trees | under `SPEC-0005`, `0006`, `0009`, `0010` | measured | `docs/specs/` |
| Scaffold template | `templates/agent-memory/AGENTS.md` rule 11: walkthroughs "land in `.agent/explain/YYYY-MM-DD-slug.md`"; `notes/README.md`: "it goes in `.agent/explain/`" | measured | `fcd58fc` |
| Scaffolding existing projects | leaves existing files untouched, so projects scaffolded earlier keep their old instructions | measured | README |
| `agent/AGENTS.md` | linked to `~/.pi/agent/AGENTS.md` by `install.sh`, so every session everywhere reads it | measured | `install.sh` |
| `doctor.sh --project <path>` | runs `validateProject` on any project | measured | `doctor.sh` |
| License | MIT | measured | `LICENSE` |
| `SPEC-0005` | index status `ready`; its §2 and §5.2 landed through `SPEC-0009`; its other sections were replaced by `SPEC-0006`, `SPEC-0010` and Lucas's decision to use both harnesses in production | in-context | this project |
| Non-walkthrough files in `.agent/explain/` | eight spec reports, six session recaps, the SPEC-0010 progress notes, one ad-hoc report, one walkthrough without an id — see §6.2 | measured | directory listing |

**Step 0:** verify every row and report expected against actual. Files present in `.agent/explain/` but not in §6.2's table follow its rules. If a contradiction changes the design, stop and report; otherwise record it and continue.

## 5. Scope

In: `lib/explain.ts`, `extensions/explain.ts`, `extensions/recap.ts`, `extensions/memory-gate.ts`, `lib/markdown.ts`, `lib/scaffold.ts`, `scripts/run-plan.mjs`, `agent/AGENTS.md`, `templates/agent-memory/`, both host files, the README and `docs/README.md`; the file moves and deletions in §6.2.

Out: the content of existing walkthroughs; `.agent/notes/`; `.agent/map/`; every spec's §1–§10, including the two v0.1 specs, which move unchanged; other projects' existing files — `doctor.sh --project` will report their strays, and tidying each is that project's own work.

**This session runs on the extensions Stage 1 changes.** Start a fresh session after Stage 1; if it fails to start, revert Stage 1's commit and stop.

## 6. Changes

### 6.0 Architecture

`extensions/explain.ts` → `lib/explain.ts` decides whether to explain, builds the prompt, parses the reply, filters `known:` lines, and names the file. `extensions/recap.ts` writes to `.agent/recaps/`. `scripts/run-plan.mjs` marks its child sessions with `PI_BUILD_PIPELINE=1`. Seam: explain writes nothing it cannot justify — no file for nothing unfamiliar, no file for a failure.

### 6.1 Stage 1: Explain, recaps, and one writer per directory

Depends on: nothing. Outcomes: O1, O2, O3.

- `lib/explain.ts` from this spec's reference: `DEFAULT_EXPLAIN_READER`, `resolveReader`, `knownPath`, `explainPrompt`, `NOTHING_UNFAMILIAR`, `parseExplanation`, `identifiersIn`, `acceptKnown`, `shouldExplain`, `walkthroughFileName`, `RECAP_DIR`.
- **Reader.** `settings/hosts/machina.json` gains `explain.reader`, set to the text in this spec's `.reference/machina-explain-reader.txt`. `settings/hosts/example.json` sets none, so it gets `DEFAULT_EXPLAIN_READER`, which describes nobody in particular.
- **Known list.** Explain reads and writes `knownPath(process.env)` — `~/.pi/agent/known.md`, one per reader, shared by every project — instead of the project's `.agent/explain/known.md`.
- `extensions/explain.ts`: capture the turn id at the start of the `agent_end` handler. Explain only when `shouldExplain(files, process.env)`. Send `explainPrompt` with `resolveReader(settings)`. Parse the reply with `parseExplanation`: if `nothing`, write nothing; otherwise write the reply to `walkthroughFileName(day, turnId)`. Add to `known.md` only `acceptKnown(parsed.known, parsed.unfamiliar, identifiersIn(<touched files' contents>))`, through the existing `mergeKnown`. A failed explain call is logged to stderr and writes no file. Remove `knownEntriesFromExplanation` if nothing else uses it.
- `extensions/memory-gate.ts`: remove the `explain_write` tool, its guideline, and its line in the injected tool list. `lib/markdown.ts`: remove `explainWriteName`; update `tests/markdown.test.ts` to match.
- `agent/AGENTS.md`: add *Record progress on a spec in its run record; for other work, in the commit message.*
- `extensions/recap.ts`: its settings key becomes `recapDir`, defaulting to `RECAP_DIR`. Rename `recap.explainDir` in the host files if present.
- `lib/scaffold.ts`: exempt `.agent/recaps/` from the neutrality rule, as `.agent/map/` is.
- **Template.** In `templates/agent-memory/AGENTS.md`, rule 11 becomes: *`.agent/explain/` is written by the harness only. Do not write there. Record progress on a spec in its run record; for other work, in the commit message. Promote a finding to `.agent/notes/*-gotchas.md` only when the trap will recur across tasks in this repo.* Its tree comment reads *walkthroughs the harness writes for the human — never written by hand*. In `notes/README.md`, the Explanations row and the "No walkthroughs" line say the same.
- `scripts/run-plan.mjs`: every child session — planner, Luna tasks, integration — runs with `PI_BUILD_PIPELINE=1`. The runner's own `.agent/` exclusion from commits stays.
- README: replace the `explain_write` sentence and the explain paragraph with the new behaviour — a walkthrough only when something is unfamiliar, two sections, recaps in `.agent/recaps/`.

Preserve: `mergeKnown`; explain's model tier and thinking level; the recap's content.

Checks: V1, V2, V3, V4, V5, V6. **Exit:** all pass, then a fresh session starts on the new extensions.

### 6.2 Stage 2: Reports to run records, and the clutter

Depends on: Stage 1. Outcomes: O2, O4.

**Reports and progress to run records.** Append each file verbatim to its spec's run record under `## Moved from \`.agent/explain/<name>\``, creating the run record if absent with the heading `# SPEC-<id> run record` and the line *Reports moved here from `.agent/explain/` on 2026-09-29, verbatim.* Then delete the original.

| File in `.agent/explain/` | Run record |
|---|---|
| `2026-09-22-diagnosis.md`, `2026-09-22-ab-results.md` | `SPEC-0001-run.md` |
| `2026-09-22-context-baseline.md` | `SPEC-0002-run.md` |
| `2026-09-23-harness-setup.md` | `SPEC-0003-run.md` |
| `2026-09-24-outcome-matrix.md` | `SPEC-0004-run.md` |
| `2026-09-26-spec-translation-step-0.md`, `2026-09-26-translation-step-1.md`, `2026-09-26-translation-step-2.md` | `SPEC-0006-run.md` |
| `2026-09-29-2026-09-29-move-specs-into-docs-specs.md` | `SPEC-0008-run.md` |
| `2026-09-29-2026-09-29-gpt6-migration-stop.md`, `2026-09-29-gpt6-migration.md` | `SPEC-0009-run.md` |
| `2026-09-29-spec-0010-*.md`, `2026-09-29-stage1-*.md` | `SPEC-0010-run.md` |

Any other non-walkthrough file that names a spec goes to that spec's run record the same way. One that names no spec — `2026-09-29-quota-footer.md` — is deleted; git history keeps it.

**Recaps.** Move every `*-session-*.md` to `.agent/recaps/`.

**The walkthrough without an id.** Rename `2026-09-29-turn.md` to `2026-09-29-turn-<ms>.md`, where `<ms>` is the Unix time in milliseconds of the commit that added it, matching the existing names.

**`known.md`.** Move it to `knownPath(process.env)`, merging with that file if it exists, and delete `.agent/explain/known.md`. Then, in the merged file, remove every entry inside the reader's baseline — core JavaScript and Python syntax and built-ins, promises and async/await, array, string, map and math methods, optional chaining and nullish coalescing, try/finally, timers, and Node's basic fs, path and process APIs — and every entry that names or describes this repository's own code rather than an API. Keep pi and pi-tui APIs, Node APIs beyond the basics, third-party libraries, TypeScript-specific features, and git and CLI options. Where two lines name the same item, keep the shorter. Expected removals include `Array.find`, `Array.map`, `setTimeout`, `try/finally`, `for...of iteration`, `object spread override`, `DEFAULT_BOUNDS test expectations` and `provider/model reference composition`; expected keeps include `ui.setFooter`, `tui.requestRender`, `pi.appendEntry` and `discriminated unions`.

**The v0.1 specs.** Move `docs/design/build-spec-pi-v0.1.md` to `docs/specs/SPEC-<id>-build-pi-harness-v0-1.md` and `docs/design/fix-spec-pi-v0.1-interop.md` to `docs/specs/SPEC-<id+1>-fix-v0-1-memory-and-grok-interop.md`, content unchanged. Add index rows: title from the H1, status `implemented`, implemented by `Grok Build`, date first added `2026-09-22`, former path. Remove `docs/design/` if empty.

**`SPEC-0005`.** Status `superseded` in the index; append after its last section `## Landing` with *§2 and §5.2 landed through SPEC-0009. The remaining sections were replaced by SPEC-0006, SPEC-0010 and Lucas's decision to use both harnesses in production.*

**Validator, last.** Only after every move above: in `validateProject` in `lib/scaffold.ts`, fail with `not a walkthrough: .agent/explain/<file>` for any file there other than `<YYYY-MM-DD>-turn-<id>.md`, tolerating a legacy `known.md`. This runs for any project through `doctor.sh --project`.

**Dead copies.** Delete `docs/reference/` and its paragraph in `docs/README.md`. Delete every `.reference/` tree under `docs/specs/` whose spec is `implemented`, `landed` or `superseded`, and this spec's own once Stage 1 has copied it into place.

Preserve: every moved report's content, byte for byte, inside its run-record section; §1–§10 of every spec.

Checks: V7, V8, V9, V10. Exit: all pass.

## 7. Paths

| Path | Trigger | Planned check or justified exclusion |
|---|---|---|
| edit turn using only baseline surface | a routine change | V1 unit; V3 live — no file |
| edit turn using an unfamiliar API | e.g. a new pi API | V1 — two sections, turn-id name |
| explain call fails | subprocess error | V1 covers the parse; V2 covers the extension — no file |
| known line for a repo name, or not in the unfamiliar section | model output | V1 — refused |
| pipeline child session | `PI_BUILD_PIPELINE=1` | V1, V5 — no walkthrough |
| session end | recap | V4 — lands in `.agent/recaps/` |
| a new project is scaffolded | `memory_bootstrap` or first session | V10 — no instruction to write explanations |
| an existing project with a stray file | `doctor.sh --project` | V10 — reported |
| a host without `explain.reader` | the open-source default | V1 — generic reader |
| report naming no spec | `quota-footer` | V7 — deleted |
| reference tree of an unfinished spec | status `ready` or `draft` | V7 — kept |
| code importing a reference tree | none exists | V9 — every spec suite still passes |

## 8. Verification

| Outcome | Change | Check ID: falsifiable condition |
|---|---|---|
| O1, O2, O5 | §6.1 | V1: `explain.test.ts` passes, 11 tests |
| O1, O3 | §6.1 | V2: `node --experimental-strip-types --test tests/*.test.ts` passes, including the updated `tests/markdown.test.ts` and a memory-gate test that `explain_write` is no longer registered |
| O1 | §6.1 | V3: in a fresh session, an edit turn that writes one file using only JavaScript basics leaves no new file in `.agent/explain/` |
| O3 | §6.1 | V4: ending that session writes its recap to `.agent/recaps/` and nothing to `.agent/explain/` |
| O1 | §6.1 | V5: a test in `tests/` shows every child session `scripts/run-plan.mjs` launches has `PI_BUILD_PIPELINE=1` |
| O3 | §6.1 | V6: `./doctor.sh --offline` passes |
| O2, O4, O5 | §6.2 | V7: `layout.test.ts` passes, 8 tests |
| O4 | §6.2 | V8: `./doctor.sh --offline` and `./doctor.sh --project .` exit 0 |
| O4 | §6.2 | V9: every `.tests/` suite under `docs/specs/` still passes |
| O5 | §6.1, §6.2 | V10: `project-rules.test.ts` passes, 4 tests — the template half from Stage 1, the validator half from Stage 2 |

You write and run the commands. **Protected** — never edit, skip or weaken to pass: this spec's `.tests/`; every other spec's `.tests/`; §1–§10 of every spec.

Invariants: explain never writes a file for a failed call or for nothing unfamiliar; no reader text lives in code except the generic default; no `known:` entry names an identifier defined in this repository; every moved report survives byte for byte in a run record.

Shared checks (every stage): `./doctor.sh --offline`, judged against the start-revision baseline.
Final integrated acceptance: V1, V2, V7, V8, V9 and V10 pass together at the final commit.
Resume baseline: `./doctor.sh --offline` before editing in any new session; record its failures as that session's baseline.

## 9. Stop conditions and repairs

If a check fails because of a local implementation error inside this scope, diagnose, fix and rerun the affected checks. Up to three repair rounds per failed check group per stage. V3 is one check group: if a walkthrough is still written for basics-only work, that is a prompt defect — repair and rerun; a second such result is a stop. Stop and report instead when: a step-0 contradiction changes the design; a fresh session fails to start after Stage 1 — revert Stage 1's commit first; a report cannot be matched to a spec and does not fit §6.2's rule; a protected file seems wrong; scope would need to grow; or the same failure repeats without a new testable diagnosis. Never mark an unrun check as passed.

On a stop, change nothing further beyond the Stage 1 revert above, and report.

Continuation: update the run record after each stage exit and each repair round. To resume, read this spec, the run record and git state, and run the resume baseline.

## 10. Report back

1. Start revision; step-0 expected against actual, including every file found in `.agent/explain/` and where it went.
2. Per stage: each V-check's command, output, pass/fail/not-run and repair rounds; the stage's exit status.
3. Final integrated acceptance, separately.
4. O-ID → evidence; which §7 paths ran.
5. `git diff --stat -M`; the full diff of any protected file, which should be empty; the changed handlers in `extensions/explain.ts` and `extensions/recap.ts` with their callers; the known list before and after; the final `/docs/specs/index.md`.
6. Deviations from §6 with reasons. The run record's path.

## 11. Landing

Filled from the review.
