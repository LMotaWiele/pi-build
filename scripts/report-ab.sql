-- One row per (root_turn_id, arm, trial). Seven measurement columns plus the key.
-- parent_turn_id points at the immediate parent. Walk to the root so a nested
-- pi and its children attribute to the trial that started them.
-- openai-codex records prompt_tokens as uncached input. When cached_tokens is
-- larger, the fields are disjoint and total input is their sum. Otherwise
-- cached_tokens is a subset and prompt_tokens is already the total.
-- total_cost_usd is the catalog estimate from §1.2 (codex Sol 5/0.50/30, Terra 2/12).
-- UNION (not UNION ALL) stops a cycle if a row names its own turn as parent.
WITH RECURSIVE chain(turn_id, root_turn_id) AS (
  SELECT DISTINCT turn_id, turn_id
  FROM inference_calls
  WHERE parent_turn_id IS NULL
  UNION
  SELECT i.turn_id, c.root_turn_id
  FROM inference_calls i
  JOIN chain c ON i.parent_turn_id = c.turn_id
  WHERE i.parent_turn_id IS NOT NULL
    AND i.turn_id != i.parent_turn_id
),
input AS (
  SELECT
    i.turn_id,
    c.root_turn_id,
    i.completion_tokens,
    i.cost_usd,
    i.cached_tokens,
    CASE
      WHEN COALESCE(i.cached_tokens, 0) > COALESCE(i.prompt_tokens, 0)
        THEN COALESCE(i.prompt_tokens, 0) + COALESCE(i.cached_tokens, 0)
      ELSE COALESCE(i.prompt_tokens, 0)
    END AS input_tokens
  FROM inference_calls i
  JOIN chain c USING (turn_id)
)
SELECT
  t.parent_turn_id AS root_turn_id,
  t.arm,
  t.trial,
  MAX(t.completed) AS completed,
  MAX(t.bound_reason) AS bound_reason,
  SUM(input.input_tokens) AS total_prompt_tokens,
  ROUND(SUM(COALESCE(input.cached_tokens, 0)) * 1.0 / NULLIF(SUM(input.input_tokens), 0), 4) AS cache_read_share,
  SUM(input.completion_tokens) AS total_completion_tokens,
  ROUND(SUM(COALESCE(input.cost_usd, 0)), 6) AS total_cost_usd,
  MAX(t.wall_clock_s) AS wall_clock_s,
  MAX(CASE WHEN input.turn_id = t.parent_turn_id THEN input.input_tokens END) AS peak_parent_prompt_tokens
FROM ab_trials t
LEFT JOIN input ON input.root_turn_id = t.parent_turn_id
GROUP BY t.parent_turn_id, t.arm, t.trial
ORDER BY t.trial;
