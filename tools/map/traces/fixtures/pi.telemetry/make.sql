-- Regenerate telemetry.db: python3 -c "import sqlite3;c=sqlite3.connect('telemetry.db');c.executescript(open('make.sql').read());c.commit()"
-- Synthetic rows with the M0 columns. The repo root in these rows is /fixture/repo (an alias in conformance.toml).
CREATE TABLE tool_calls (id INTEGER PRIMARY KEY, ts INTEGER NOT NULL, session_id TEXT NOT NULL, turn_id TEXT NOT NULL,
  loop_index INTEGER, tool_name TEXT NOT NULL, arguments TEXT NOT NULL, path TEXT, result_bytes INTEGER, elapsed_ms INTEGER,
  outcome TEXT, blocked_by TEXT, parent_turn_id TEXT, tool_call_id TEXT, project_root TEXT, subagent_role TEXT);
CREATE TABLE inference_calls (id INTEGER PRIMARY KEY, ts INTEGER NOT NULL, session_id TEXT NOT NULL, turn_id TEXT NOT NULL,
  loop_index INTEGER, tier TEXT NOT NULL, model TEXT NOT NULL, prompt_tokens INTEGER, cached_tokens INTEGER,
  completion_tokens INTEGER, reasoning_tokens INTEGER, ttft_ms INTEGER, elapsed_ms INTEGER, cost_usd REAL,
  parent_turn_id TEXT, project_root TEXT, subagent_role TEXT);
-- Turn A (session s1): rule 2 (absolute), rule 3 (relative in the same session), a blocked read, a dedupe.
INSERT INTO inference_calls VALUES (1, 1000, 's1', 'A', 1, 'work', 'm-small', 100, 40, 20, 5, 50, 400, 0.01, NULL, NULL, NULL);
INSERT INTO tool_calls VALUES (1, 1200, 's1', 'A', 1, 'read', '{"path":"SECRET-ARGUMENT-1"}', '/fixture/repo/README.md', 10, 20, 'success', NULL, NULL, 'c1', NULL, NULL);
INSERT INTO tool_calls VALUES (2, 1300, 's1', 'A', 1, 'edit', '{"path":"SECRET-ARGUMENT-2"}', 'src/app.py', 0, 30, 'success', NULL, NULL, 'c2', NULL, NULL);
INSERT INTO inference_calls VALUES (2, 2000, 's1', 'A', 2, 'escalate', 'm-large', 300, 200, 50, 10, 80, 600, 0.05, NULL, NULL, NULL);
INSERT INTO tool_calls VALUES (3, 2100, 's1', 'A', 2, 'read', '{}', 'src/app.py', 0, NULL, 'deduped', 'read-guard', NULL, 'c3', NULL, NULL);
INSERT INTO tool_calls VALUES (4, 2200, 's1', 'A', 2, 'read', '{}', '/fixture/repo/.agent/notes/x.md', 0, 5, 'blocked', 'memory-gate', NULL, 'c4', NULL, NULL);
-- Turn C: an explain child of A (M0 parent and role), rows keep their own session.
INSERT INTO inference_calls VALUES (3, 3000, 'child', 'C', 1, 'explain', 'm-small', 500, 0, 100, 0, 90, 900, 0.02, 'A', '/fixture/repo', 'explain');
INSERT INTO tool_calls VALUES (5, 3100, 'child', 'C', 1, 'read', '{}', 'src/app.py', 0, 15, 'success', NULL, 'A', 'c5', '/fixture/repo', 'explain');
-- Turn B (session s2): rule 1 via project_root only.
INSERT INTO inference_calls VALUES (4, 5000, 's2', 'B', 1, 'work', 'm-small', 50, 0, 10, 0, 30, NULL, 0.001, NULL, '/fixture/repo', NULL);
-- Turn Z (session s3): another project; ignored.
INSERT INTO inference_calls VALUES (5, 6000, 's3', 'Z', 1, 'work', 'm-small', 50, 0, 10, 0, 30, 100, 0.5, NULL, '/elsewhere', NULL);
INSERT INTO tool_calls VALUES (6, 6100, 's3', 'Z', 1, 'read', '{}', '/elsewhere/README.md', 0, 5, 'success', NULL, NULL, 'c6', '/elsewhere', NULL);
