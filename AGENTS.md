<!-- agent-memory-schema: 1 -->
# pi-build

This file is the contract for the harness repository. The file other projects start from is `templates/agent-memory/AGENTS.md`.

## Layout

- `extensions/` and `lib/` are the harness. The installer symlinks them into the agent config directory.
- `.agent/` is project memory. Files under it describe behaviour: read the index, then one linked note. They do not name a harness tool, a harness path, or a harness setting.
- `.pi/` and `.grok/` are harness wiring. They can sit side by side. Do not merge them, and do not require either directory to exist.
- `templates/agent-memory/` is what a session copies into a project that does not have these files yet. Copying never replaces a file that is already there.
- `settings/hosts/machina.json` is one person's model list. `settings/hosts/example.json` is the portable host: one model id is enough, a decision endpoint turns on routing, and distinct ids per tier are how work is split.
- `scripts/migrate-notes.js` rewrites a legacy notes tree into siblings for a person to review. A session does not run it.

## Checks

```bash
node --experimental-strip-types --test tests/*.test.ts
./doctor.sh --offline
./doctor.sh --project .
```

## Notes

Read `.agent/notes/INDEX.md` first, then exactly one linked note. After a finding, update that note's front-matter. Queue writes go to the index. Do not bulk-read the notes directory.
