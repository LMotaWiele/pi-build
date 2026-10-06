File: /docs/specs/SPEC-0016-compare-read-guard-content.md
# SPEC-0016: Compare read-guard content before suppressing re-reads

| Field | Value |
|---|---|
| Status | implemented |
| Size | M |
| Kind | fix |
| Parent | — |
| Date | 2026-10-06 |

Assign the next free SPEC ID in `/docs/specs/` and rename this file accordingly; don't reuse an ID.

Read `/.agents/notes/index.md` if present. Record the revision you start from and any pre-existing uncommitted changes; don't fold unrelated work into this change.

## 1. Intent
`read-guard.ts` suppresses repeated reads to save tokens. It decides whether a file is unchanged by tracking Pi's own successful `edit` and `write` calls. Changes made any other way are invisible to it: Bash commands, formatters, generators, the user's editor, and Grok Build, which runs against the same repositories. In those cases the model receives "already read this turn … unchanged" while the file on disk differs. This was reproduced in an external review: Pi reads `value = 1`, another process writes `value = 2`, Pi reads again, and the guard replaces the fresh result with the unchanged pointer.

Agreed decisions: keep the token savings; base the decision on the content the read actually returned, which the guard already receives before replacing it; normalize paths so aliases share one entry; on change, return a diff when that's smaller than the full result, otherwise the full result.

- O1: A re-read returns the "unchanged" pointer only when the content the read tool returned is byte-identical to the content last delivered to the model for the same file and the same range.
- O2: When the content differs, the model receives either a unified diff against the last-delivered content, headed with a one-line notice that the file changed since it was last read, or the full fresh result. Never the pointer.
- O3: Relative paths, absolute paths, `./`-prefixed paths and symlinked paths referring to one file share one guard entry.
- O4: Identical re-reads are still suppressed, so the existing token savings remain.
- O5: The guard can be disabled with a single switch, in which case every read passes through unmodified. Reuse an existing toggle if one exists; otherwise add an environment variable and document it next to the guard.

## 2. Priority
This is the highest-priority fix in the live build. It silently feeds the model stale file state, and the trigger (Pi and Grok Build working on the same repository) is normal daily use. Deferred: everything else from the 2026-09-30 review, including the typecheck hook, which is a separate spec.

## 3. Prior art
N/A — this is a local fix. The mechanism (compare against the last-delivered content, then return a diff or full result on mismatch) is the standard way to make a read cache safe against external writers.

## 4. Grounding
| Fact | Expected | Tag | Source |
|---|---|---|---|
| Guard location | `read-guard.ts` in the harness extensions | in-context | review of commit 1e32e3c |
| Current "changed" decision | Derived from successful Pi `edit`/`write` calls, not from content | in-context | review of 1e32e3c |
| Guard sees the fresh read result before replacing it | yes | in-context | review of 1e32e3c |
| Suppression scope | "this turn" (per the pointer text); confirm the actual scope | agent-verify | source |
| Read tool supports partial reads (offset/limit or similar) | unknown | agent-verify | Pi read tool definition, pinned runtime 0.99.1 |
| Read tool can return non-text (images, binary) | unknown | agent-verify | Pi read tool definition |
| An existing diff utility (used for diffs after tracked edits) | exists in the harness | in-context | review of 1e32e3c |
| Existing guard tests | unknown | agent-verify | repo |
| How the live Pi session loads this extension (path or symlink into this repo, settings entry, or an installed copy) | unknown | agent-verify | Pi settings, installer |
| Pre-existing failing tests at start | review saw 8 failing (6 tied to historical repository paths, 2 needing an installed Pi), 1 skipped | agent-verify | run the suite |

Step 0: before editing, verify every row that describes repo or environment state (whatever its tag) and report expected vs actual. If a contradiction changes the design, outcomes, scope or verification, stop and report. Otherwise record it and continue.

## 5. Scope
In: the guard's suppression decision, path normalization, diff-or-full on change, the disable switch, regression and property tests, a short note in the guard's documentation. Out: the typecheck hook, telemetry schema changes, other context-efficiency features, harness installer changes.

## 6. Changes
### 6.1 Content-based decision
Outcomes: O1, O2, O4. Where: `read-guard.ts`; agent confirms.
Change: per guard entry, store the content last delivered to the model. On a read, compare the fresh result's content with the stored content. If identical, return the existing pointer. If different, build a unified diff with the existing diff utility. Return the diff with the change notice if it's shorter than the full result; otherwise return the full result. Then update the stored content. The correctness of this decision must not depend on edit/write tracking; that tracking may stay as additional invalidation or be removed.
Preserve: the pointer's wording and the suppression scope found in step 0; behavior for first reads; the diffs shown after tracked edits.
Seams: read tool result → guard → model. Pass error results through unchanged and clear that path's entry. Pass non-text results through unchanged and don't store them. For partial reads, key the entry by path plus range; if a partial read's content changed, return the full fresh result rather than a diff.

### 6.2 Path normalization
Outcomes: O3. Where: the guard's entry key; agent confirms.
Change: resolve paths against the session working directory, then resolve symlinks when the file exists. If symlink resolution fails, for example because the file was deleted, fall back to the resolved absolute path.

### 6.3 Disable switch
Outcomes: O5. When the switch is set, the guard does nothing and every read passes through as returned.

### 6.4 Activation in the live build
Outcomes: none on its own; this supports the intent. Report exactly what the user must do for the running Pi to pick up this change: restart Pi, rerun the installer, or nothing. If it requires the installer or changing global configuration outside this repository, report the command and do not run it.

## 7. Paths
| Path | Trigger | Planned check or justified exclusion |
|---|---|---|
| happy: identical re-read | read, read again, no change | V1 |
| external change between reads | read; write file from outside Pi; read | V2 |
| Pi's own edit then re-read | read; Pi edit; read | V3 |
| path aliases | read `src/a.ts`; external change; read `./src/a.ts`, absolute path, and symlink | V4 |
| partial reads | read range A; read range B; change file; read range A again | V5 (or not exercised if step 0 finds no partial reads) |
| error / deleted file | read; delete file; read; recreate with new content; read | V6 |
| non-text result | read an image or binary, if the tool supports it | V7 (or not exercised if unsupported) |
| large change | rewrite most of a file externally; read | V8 |
| scope boundary | identical re-read after the guard's scope resets (turn or session, per step 0) | V9 |
| switch on | switch set; identical re-read | V10 |

## 8. Verification
| Outcome | Change | Check ID: falsifiable condition |
|---|---|---|
| O4 | §6.1 | V1: identical re-read returns the pointer |
| O1, O2 | §6.1 | V2: after an external write, the re-read contains the new content (as a diff or full result) and never the pointer. **Run V2 against the start revision first and record that it fails there.** |
| O1, O2 | §6.1 | V3: after a Pi edit, the re-read is not the pointer |
| O3 | §6.2 | V4: all aliases map to one entry; a changed file read through any alias is not suppressed |
| O1 | §6.1 | V5: a changed range returns full content; a different range is never suppressed by another range's entry |
| O1 | §6.1 | V6: the error passes through; after recreation the new content is delivered |
| O1 | §6.1 | V7: the non-text result is unchanged by the guard |
| O2 | §6.1 | V8: the full result is returned when the diff would be at least as long as the full result |
| O4 | §6.1 | V9: the preserved scope behaves as it did before |
| O5 | §6.3 | V10: every read passes through unmodified |
| O1 | §6.1–6.2 | V11: property test (see invariants) |

You write and run the commands. Protected (never edit, skip or weaken to pass): all existing tests. If an existing test asserts the old edit-tracking behavior in a way that contradicts O1, stop and report rather than editing it. Baseline: record the set of failing tests at the start revision; the set must not grow.

Invariants: across any sequence of {read through any path alias and range, external write, Pi edit, Pi write, delete, recreate}, the guard never returns the pointer when the fresh content differs from the last-delivered content for that path and range. Test this with a property test: use fast-check if it's already a dependency; otherwise use a seeded deterministic generator in the test file, with no new dependency. Run at least 500 sequences and report the seed.

## 9. Stop conditions and repairs
If a check fails because of a local implementation error inside this scope, diagnose, fix, rerun the affected checks. Up to three repair rounds per failed check group. Stop and report instead when: a step-0 contradiction changes the design; a seam differs from §6; scope would need to grow; a protected file seems wrong; an external prerequisite is missing; or the same failure repeats without a new testable diagnosis. Never mark an unrun check as passed.

When all checks pass, commit on the current branch with the spec ID in the message. Do not push.

## 10. Report back
1. Start revision; step-0 expected vs actual.
2. Each V-check: command, output, pass/fail/not-run, repair rounds used. Include V2's failing output at the start revision.
3. O-ID → evidence; which §7 paths actually ran.
4. `git diff --stat` for the whole change, full diff of any protected file (should be empty), and the complete changed functions with their callers.
5. Failing-test set at start vs at end.
6. Activation: what the user must do for the live Pi to load the change (§6.4).
7. Deviations from §6 with reasons; anything the spec didn't anticipate.

## 11. Landing
Filled from the review.
