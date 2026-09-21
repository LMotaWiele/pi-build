-- §16 acceptance table, one query. sqlite3 ~/.pi/agent/telemetry.db < scripts/report.sql
WITH inf AS (
  SELECT
    session_id,
    ROUND(SUM(cost_usd), 4) AS cost_usd,
    ROUND(SUM(cached_tokens) * 1.0 / NULLIF(SUM(prompt_tokens), 0), 4) AS cache_hit_rate,
    ROUND(SUM(reasoning_tokens) * 1.0 / NULLIF(SUM(completion_tokens), 0), 4) AS reasoning_share,
    ROUND(SUM(CASE WHEN tier = 'escalate' THEN 1 ELSE 0 END) * 1.0 / NULLIF(COUNT(*), 0), 4) AS escalation_share
  FROM inference_calls
  GROUP BY session_id
),
tools AS (
  SELECT
    session_id,
    ROUND(
      SUM(CASE WHEN outcome = 'deduped' THEN 1 ELSE 0 END) * 1.0
      / NULLIF(SUM(CASE WHEN tool_name = 'read' THEN 1 ELSE 0 END), 0),
      4
    ) AS wasted_reread_rate,
    ROUND(
      SUM(CASE WHEN tool_name = 'note_open' THEN 1 ELSE 0 END) * 1.0
      / NULLIF(COUNT(DISTINCT turn_id), 0),
      4
    ) AS note_opens_per_turn,
    SUM(CASE WHEN blocked_by = 'memory-gate' THEN 1 ELSE 0 END) AS raw_notes_blocked,
    ROUND(
      COUNT(DISTINCT CASE WHEN blocked_by = 'bounds' THEN turn_id END) * 1.0
      / NULLIF(COUNT(DISTINCT turn_id), 0),
      4
    ) AS bound_turn_rate
  FROM tool_calls
  GROUP BY session_id
)
SELECT
  inf.session_id,
  inf.cost_usd,
  inf.cache_hit_rate,
  inf.reasoning_share,
  tools.wasted_reread_rate,
  tools.note_opens_per_turn,
  tools.raw_notes_blocked,
  tools.bound_turn_rate,
  inf.escalation_share
FROM inf
LEFT JOIN tools ON tools.session_id = inf.session_id
ORDER BY inf.session_id;
