-- Hook order and prefix invalidation points.
-- sqlite3 "$PI_BUILD_TELEMETRY_DB" < scripts/report-hooks.sql
--
-- A prefix invalidation is a handler that changed the byte size of a
-- prefix-bearing payload: the system-prompt sections, the message list,
-- or a compaction. Tool-result rows are touches, not invalidations.

SELECT session_id, turn_id, event, seq, extension, key_or_tool, bytes_before, bytes_after
FROM hook_touches
ORDER BY session_id, turn_id, seq;

SELECT session_id, turn_id, COUNT(*) AS invalidation_points
FROM hook_touches
WHERE bytes_before != bytes_after
  AND event IN (
    'before_agent_start',
    'context',
    'context_with_system',
    'session_before_compact',
    'session_compact'
  )
GROUP BY session_id, turn_id
ORDER BY session_id, turn_id;
