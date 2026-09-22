# Fix spec — Pi v0.1 closeout: memory enforcement, Grok interop

**Place at:** `docs/design/fix-spec-pi-v0.1-interop.md`
**Audience:** coding agent. Amends `pi-build` in place: closes the open issues from the v0.1 build report, adds per-project memory scaffolding and enforcement, and makes the memory layer work interchangeably with Grok Build. One new extension component, one new parser schema, one new template tree, one new script. No changes to any project's `src/`.
**Read first:** `docs/design/build-spec-pi-v0.1.md` (§0 conventions apply unchanged), `AGENTS.md`, `.agent/notes/INDEX.md`, this file in full.
**Status:** spec, ready to build
**Amends:** `build-spec-pi-v0.1.md` §3, §6, §12.1, §14, §16

---

## §0 Conventions

The **DISCOVER** / **VERIFY** / **stop and ask** protocol from `build-spec-pi-v0.1.md` §0.2
applies unchanged. So do the global constraints in §0.3 — no commits, no unpinned installs, no
new top-level directories beyond those named here.

Where this spec and the v0.1 spec disagree, **this one wins**, and the v0.1 section is named.

---

## §1 Decisions taken

These three were flagged open in the build report. They are now closed. Do not re-open them.

### 1.1 `blockRawNotesReads` stays `true`

The v0.1 spec's build order ran the first session in shadow mode. That is overruled: the gate
is on from the start.

The risk shadow mode was covering — path-matching being wrong, and the gate refusing reads the
agent legitimately needs — is handled three other ways instead. All three must be in place:

1. **Unit tests on the matcher** (v0.1 §6.6) must pass before the gate ships: fires on
   `.agent/notes/x.md`, does **not** fire on `.agent/skills/`, `.agent/explain/`, or
   `docs/design/`.
2. **Documented escape hatches**, each logged: `override: true` on `note_open` for a second
   note in a task, `force: true` on a read, and `memoryGate.enabled: false` as a kill switch.
   The rejection message must name the relevant one — a rejection with no way forward is a
   dead end, not a guard.
3. **Rejection-rate telemetry.** Every rejection logs the path and the suggested alternative.
   If the rate does not trend toward zero over the first sessions, the matcher is wrong, not
   the model.

**Cross-repo edge case**, new since `pi-build` has its own `.agent/` tree: the gate applies to
`.agent/notes/` under the **active project root only** (§6.2). A notes path under a different
root cannot be resolved by `note_open` — a different INDEX governs it — so it passes through as
a raw read with a warning naming both roots. Blocking it would leave no path to the file at
all.

### 1.2 `kcosr/pi-extensions` — decide and record

It was skipped with no reason. Pick one branch, implement it, and write the reason into
`pi-build/.agent/notes/INDEX.md`:

**Branch A — own telemetry is sufficient.** Verify that `lib/telemetry.ts` captures, for
**every** tool call including blocked and deduplicated ones, all of the v0.1 §13 `tool_calls`
columns: `arguments` with paths present, `path` extracted, `result_bytes`, `outcome` covering
`blocked` and `deduped`, and `blocked_by`. If it does, remove the row from the v0.1 §12.1
manifest permanently and record that own telemetry supersedes it.

**Branch B — it is not sufficient.** Install `kcosr/pi-extensions` pinned by tag or commit,
configured `approval: false` and `logToolArguments: true` (v0.1 §12.2 — logging on, gate off),
and wire its log into `report.sql` alongside the own tables.

Branch A is preferred: one fewer dependency, and the acceptance query in v0.1 §16 is written
against the own schema. But it is only correct if the verification actually passes. Do not
assume it.

### 1.3 Two `INDEX.md` files is correct

`pi-build` is a project. It gets the full memory structure, same as any other. §6 below makes
that explicit in the file manifest.

The rule that removes the ambiguity: **the active project root is the nearest ancestor
directory of the cwd containing `AGENTS.md`**, falling back to the nearest containing
`.agent/`. All memory-gate operations — injection, `note_open`, `queue_append`,
`explain_write`, rejection — resolve against that root and no other.

Harness work queues in `pi-build`'s INDEX. Project work queues in the project's INDEX. Neither
references the other; a cross-reference would make one of them a partial authority, which is
exactly what the single-authority rule exists to prevent.

---

## §2 Blocking issues

### 2.1 Model resolution assertion — do this first

**The most serious finding in the report.** `openai/gpt-5.6-luna` partial-matching an
OpenRouter model id is a silent failure that produces plausible output. Three things break at
once and none of them is visible:

- cost accounting reads the wrong rate card, so every §16 number is wrong
- native web search stops working (v0.1 §17 routes on the provider being `openai`; OpenRouter
  is not)
- the cache-read ratio being measured belongs to a different provider

OpenRouter's slug convention is `openai/<model>`, so the collision is structural, not
incidental. It will probably stop happening once `OPENAI_API_KEY` is set and the built-in
catalog registers the exact ids — but "probably" is not adequate for a failure mode that
produces believable numbers.

Implement `assertModelResolution()`:

- On session start, for every tier in `routing.tiers`, resolve the configured model id through
  pi's registry and compare the **resolved provider** against the expected provider for that
  tier.
- Mismatch → refuse to start the session, naming the tier, the configured id, the expected
  provider, and the resolved one.
- Also assert the resolved id is an **exact** match for the configured string. A fuzzy or
  partial match is a failure even when the provider happens to be right.

**DISCOVER** whether the resolved provider and id are reachable from the CLI. If they are, put
the check in `doctor.sh`. If not, a small startup extension is the place — it is a few lines
and it guards every acceptance metric in the build.

### 2.2 Dead `escalate` tier

`openai-codex/gpt-5.6-sol` matches nothing, and v0.1 §11.1 sets `defaultOnUncertain:
"escalate"`. The default-on-doubt branch currently routes nowhere.

Two changes:

1. **Point `escalate` at `openai/gpt-5.6-terra`** until the codex id resolves. Record it as a
   temporary value with a correction row in `pi-build`'s INDEX.
2. **Add tier fallback.** If a tier's model fails to resolve at startup, fall back to the next
   tier down (`escalate` → `work` → `scout`) and warn loudly on every turn that uses the
   fallback. Never route to a tier that resolves to nothing. A routing table with a dead branch
   is worse than no routing, and worst when the dead branch is the default.

**VERIFY** after `/login` completes: list what the Plus subscription actually exposes through
`openai-codex`. If a Sol-class id is not there, `escalate` is Terra permanently — update
`models.json`, drop the fallback warning, and note that the cost model improves.

### 2.3 Credentials and offline validation

`doctor.sh` exiting 1 on unset `OPENAI_API_KEY` is correct behaviour, but it means a fresh
clone cannot be validated at all until keys exist.

Add `doctor.sh --offline`: runs every check that does not need credentials — JSON validity,
binary presence, `pi list` against the committed `packages` array, skill/README drift, the
memory-structure validation in §3.4, unit tests, startup timing — and skips the tier smokes and
live tool calls with a clear "skipped: no credentials" line each. Exit 0 if the offline subset
passes.

Full `doctor.sh` keeps failing loudly when keys are missing.

### 2.4 Missing status bar → turn-end cost line

The `enhansome` status-bar and todos packages were not installed. Record the outcome in
`pi-build`'s INDEX: not found, does not work, or not attempted. If either does not exist, remove
it from the v0.1 §12.1 manifest rather than leaving a row that implies future work.

The status bar was the only live cost visibility in the design. Without it the first session
flies blind until `report.sql`. Mitigate cheaply — `lib/telemetry.ts` already has the data:

At the end of every turn, write one line to the session log: tier used, inference calls, prompt
tokens, cache hit %, completion tokens, reasoning %, turn cost, cumulative session cost. One
line, no TUI work, and it makes the §16 metrics observable while you work instead of afterward.

---

## §3 Per-project memory structure — scaffold and enforce

New requirement. The harness is responsible for the memory structure existing and being valid
in every project it runs in, not only in projects that happen to have it.

### 3.1 The required structure

```
<project-root>/
├── AGENTS.md                              # the shared contract — see §4.2
└── .agent/
    ├── notes/
    │   ├── INDEX.md                       # entrypoint + queue (authority)
    │   └── README.md                      # the protocol, human-canonical
    ├── skills/
    │   └── notes-protocol/SKILL.md        # generated from README.md — see §4.4
    └── explain/                           # created lazily on first write
```

`.pi/` and `.grok/` are harness wiring and are **not** part of this structure. §4.3.

### 3.2 Templates

New tree: `pi-build/templates/agent-memory/`, containing the canonical `AGENTS.md`,
`INDEX.md`, and `notes/README.md`. These are the same files already reviewed; move them here
rather than writing new ones.

Each template carries a `schema:` marker so drift between a scaffolded project and the current
template is detectable. Put it in an HTML comment at the top —
`<!-- agent-memory-schema: 1 -->` — so it is invisible in rendered markdown and survives hand
editing.

### 3.3 `memory_bootstrap` — behaviour

On session start, memory-gate checks the active project root for §3.1:

| State | Action |
|---|---|
| Complete and parseable | Proceed. |
| Missing entirely or partially | Create only the missing files from templates. **Never overwrite an existing file.** Log a per-file diff. Continue the session. |
| Present but unparseable | Loud parse error, fall open to raw reads for that file (v0.1 §6.2), append a correction row to the queue if INDEX itself parsed. |
| Schema marker older than current template | Warn once, naming `migrate-notes`. Do not migrate. |

Creation is additive and non-destructive, so `autoScaffold` defaults to `true`. Expose it as a
setting so it can be turned off, and expose the same logic as a tool, `memory_bootstrap()`, for
explicit invocation.

**Never scaffold outside the active project root.** Never create `src/`, `tests/`, or anything
else from `AGENTS.md`'s layout section — this scaffolds memory structure only, not project
structure.

### 3.4 `doctor.sh --project <path>`

Validates one project's memory structure without running a session: all §3.1 files present,
INDEX and every linked note parse, every INDEX row's `Status` matches the linked note's
`**Status:**` line (the v0.1 §6.4 drift check, now reusable), the skill matches README.md, and
the schema marker matches the current template. Exit non-zero on any failure, with a per-check
line.

This is also what the pre-commit hook calls, so write it once.

---

## §4 Interoperability with Grok Build

Grok Build becomes the backup CLI. Both harnesses must work on the same repo, in either order,
without conversion. Grok adapts to a project by reading `AGENTS.md`; that is the mechanism this
section protects.

### 4.1 P1 — `.agent/` is harness-neutral

Nothing under `.agent/` may name a pi tool, a pi path, a pi setting, or a pi extension. The
protocol describes **behaviour** — "read INDEX first, then exactly one linked note" — never a
mechanism.

Audit `.agent/notes/README.md` and the templates for this before shipping. A single mention of
`note_open` in a file grok reads makes the repo pi-only.

### 4.2 P2 — `AGENTS.md` is the shared contract

Both harnesses read it. It states the rules; pi enforces some of them mechanically, grok
follows them by instruction. This is why the contract must be written as rules rather than as
tool usage.

The template `AGENTS.md` must therefore:

- state the notes access rule in behavioural terms (INDEX first, then one note, update
  front-matter after a finding, queue writes go to INDEX)
- name `.pi/` and `.grok/` as harness wiring that must not be merged, without depending on
  either existing
- **not** depend on rule numbering. A project may carry the older 10-rule variant or the newer
  12-rule one. Nothing in the harness may reference "rule 7" programmatically — match on
  content or not at all.

### 4.3 P3 — harness-specific instruction is injected, never written into the repo

pi tells its own agent about `note_open` by **injecting** it at session start, alongside the
INDEX block it already injects (v0.1 §6.3). Grok's equivalents live in `~/.grok/AGENTS.md`,
outside any project.

This is the rule that keeps the repo neutral while both harnesses still know how to behave. It
also resolves the obvious objection to §1.1 — if `AGENTS.md` cannot mention `note_open`, the pi
agent would try `read_file` and be rejected — because the injection carries it instead.

Corollary: `.pi/` and `.grok/` coexist at the project root, unmerged, neither required. The
harness must not error, warn, or clean up when it finds the other one's directory.

### 4.4 P4 — the protocol skill lives in the project, not in pi-build

**Amends v0.1 §14.1.** The `notes-protocol` skill goes in
`<project>/.agent/skills/notes-protocol/SKILL.md`, not in pi-build's global skills directory.

Reason: `.agent/skills/` is shared knowledge that both harnesses load. A skill in pi's global
directory is invisible to grok, which would then have to read `README.md` as a file — the exact
cost this design removed.

pi-build's `templates/agent-memory/` holds the generation source. The scaffold writes the
per-project copy. `doctor.sh --project` checks it has not drifted from README.md.

Project `.pi/settings.json` keeps `"skills": [".agent/skills"]` so pi loads it in place.

### 4.5 P5 — everything pi writes must be hand-editable and grok-readable

`note_update`, `queue_append`, and `explain_write` produce plain markdown in the documented
format. Specifically:

- **No machine markers inside the files.** The injection marker from v0.1 §6.3 lives in the
  **context**, never in `INDEX.md`. This is an easy footgun: a marker written into INDEX so
  that recap can find its own block would corrupt the file for grok and for the human.
- No pi-only front-matter keys. The schema in `README.md` is the whole schema.
- No reformatting. `note_update` patches one field and leaves the rest byte-for-byte, including
  whitespace and table padding. A pi write must be indistinguishable from a hand edit in a diff.

### 4.6 P6 — two writers, one file

Both harnesses may edit `INDEX.md` and the notes, on different days.

- Queue writes are **append-only**. Never renumber, never reorder, never rewrite the table.
- Note writes patch a single field. Never rewrite a whole note.
- Before any write, re-read the file from disk. Never write from a copy cached at session
  start — grok may have edited it since.
- The drift check (§3.4) catches inconsistency after the fact. It is the backstop, not the
  mechanism.

### 4.7 Round-trip test

Required, and it is the acceptance test for this whole section:

1. Scaffold a scratch project with pi (`memory_bootstrap`).
2. Confirm nothing under `.agent/` names a pi tool, path, or setting — grep for `note_open`,
   `pi-build`, `.pi/`, `memoryGate`.
3. Run a session with pi: open a note, patch a field, append a queue row.
4. Hand-edit the same files as grok would — plain markdown, no tooling.
5. Reopen with pi: INDEX and the note parse, the hand edits survive, the drift check passes.

Automate steps 1–3 and 5. Step 4 can be a fixture representing a hand edit.

---

## §5 Legacy format compatibility

Existing projects carry the older grok template. Both formats must work, unconverted, in both
harnesses.

### 5.1 The two schemas

| Surface | v0 (legacy) | v1 (current) |
|---|---|---|
| INDEX notes list | table, no `## Notes` heading | table under `## Notes` |
| INDEX queue | `## Active next` as a bullet list | `## Active next` as a `\| # \| Item \| Source \| Added \|` table |
| INDEX constraints | `**Do not:**` as a bullet inside Active next | its own `## Do not` section |
| Note criteria heading | `## Pre-committed next` | `## Pre-committed criteria` |

### 5.2 Parser changes

**Amends v0.1 §6.2.**

- `parseIndex` returns `schemaVersion: 0 | 1` alongside the existing fields, and normalises
  both into the same `ParsedIndex` shape. Callers should not branch on the version.
- Detection: a pipe table under `## Active next`, or the presence of a `## Notes` heading →
  v1. Otherwise v0. Record the detected version in the log at session start.
- `parseNote` accepts **either** criteria heading and normalises to `preCommitted`. The
  `criteria_eval` question set (v0.1 §10.3) reads whichever exists.
- Unit tests run the full suite against both fixtures. Use the actual uploaded v0 templates as
  the v0 fixture, not a reconstruction.

### 5.3 Writer changes

`queue_append` **must write in the detected schema**. Appending a table row to a bullet list
corrupts the file, and it corrupts it for grok too. In v0 it appends a bullet; in v1 it appends
a table row with the next `n`.

Same for any other writer that touches a structured section.

### 5.4 `scripts/migrate-notes.js`

Converts one project v0 → v1. Non-destructive: writes `INDEX.v1.md` and `<note>.v1.md`
alongside the originals and prints a diff. The human reviews and renames.

**Never auto-migrate**, and never migrate as a side effect of a session. A project that stays
on v0 must keep working indefinitely — grok may be driving it.

---

## §6 `pi-build` as a project

**Amends v0.1 §3.** Add to the repo layout:

```
~/src/pi-build/
├── AGENTS.md                          # this repo's contract, harness-neutral
├── .agent/
│   ├── notes/INDEX.md                 # the harness work queue
│   ├── notes/README.md
│   ├── skills/notes-protocol/SKILL.md
│   └── explain/
├── templates/agent-memory/            # §3.2 — scaffold source
│   ├── AGENTS.md
│   ├── INDEX.md
│   └── notes/README.md
├── scripts/
│   ├── report.sql                     # v0.1 §13
│   └── migrate-notes.js               # §5.4
└── ... (everything from v0.1 §3)
```

`pi-build/AGENTS.md` describes the harness repo itself — its layout, its test commands, the
constraint that `.agent/` content stays harness-neutral. It is not the template; the template
is the one under `templates/`.

Seed `pi-build/.agent/notes/INDEX.md § Active next` with the correction rows this spec
generates: the kcosr decision (§1.2), the escalate-tier fallback (§2.2), the enhansome outcome
(§2.4), and the codex model id verification.

---

## §7 Build order

```
 1. §2.1 assertModelResolution   ← first; it guards every measurement below
 2. §2.2 escalate → terra, tier fallback
 3. §1.2 kcosr decision: verify telemetry coverage, pick a branch, record it
 4. §5.2 parser v0/v1 + fixtures from the real legacy templates
 5. §5.3 schema-aware writers
 6. §3.2 templates/agent-memory/ (move the existing reviewed files)
 7. §6 pi-build's own .agent/ tree; seed the queue with the correction rows
 8. §3.3 memory_bootstrap; §1.1 cross-root edge case
 9. §4.4 move notes-protocol skill to per-project; update project settings
10. §4.5 audit every writer for markers, key additions, reformatting
11. §3.4 doctor.sh --project; §2.3 doctor.sh --offline
12. §2.4 turn-end cost line
13. §5.4 migrate-notes.js
14. §4.7 round-trip test
15. Keys set → full doctor.sh → §2.2 VERIFY the codex id → one real session
```

Steps 1–3 are unblocking. 4–5 are prerequisites for touching any project on the old template —
do not run the harness against a legacy project before step 5.

---

## §8 Acceptance

Adds to v0.1 §16. These are pass/fail, not trends.

| Check | Pass condition |
|---|---|
| Model resolution | Every tier resolves to an exact id on the expected provider; a deliberate mismatch refuses to start |
| Dead tier | No tier resolves to nothing; fallback warns on every use |
| Legacy parse | Full parser suite passes against the real v0 templates |
| Schema-aware write | `queue_append` on a v0 INDEX appends a bullet; on v1, a table row |
| Neutrality | `grep -rE 'note_open\|memoryGate\|\.pi/\|pi-build' <project>/.agent/` returns nothing |
| Round trip | §4.7 passes end to end |
| Scaffold safety | Bootstrap never overwrites an existing file; verified with a fixture where every file exists with different content |
| Cross-root | A notes read outside the active project root passes through with a warning |
| Offline doctor | `doctor.sh --offline` exits 0 with no credentials set |
| Drift | `doctor.sh --project` fails on a deliberately mismatched INDEX row status |

---

## §9 Do not

Everything in v0.1 §18 still holds. Additionally:

- **Do not write pi-specific anything into `.agent/`.** §4.1. This is the constraint that makes
  Grok a usable backup, and it is a one-line mistake to break.
- **Do not write machine markers into `INDEX.md` or any note.** §4.5. The recap injection marker
  belongs in the context.
- **Do not auto-migrate a v0 project.** §5.4. It may be grok's.
- **Do not overwrite an existing file during scaffold.** §3.3, ever, for any reason.
- **Do not reformat a file you are patching.** §4.5. One field, byte-for-byte elsewhere.
- **Do not reference `AGENTS.md` rule numbers programmatically.** §4.2. Two rule sets exist.
- **Do not error or warn on finding `.grok/`.** §4.3. It is expected.
- **Do not scaffold project structure** — `src/`, `tests/`, `docs/`. §3.3 covers memory
  structure only.
- **Do not re-open §1.** Those three are decided.
