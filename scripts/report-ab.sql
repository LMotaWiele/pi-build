-- One row per (parent_turn_id, arm, trial). Seven measurement columns plus the key.
-- openai-codex records prompt_tokens as uncached input. When cached_tokens is
-- larger, the fields are disjoint and total input is their sum. Otherwise
-- cached_tokens is a subset and prompt_tokens is already the total.
-- total_cost_usd is the catalog estimate from §1.2 (codex Sol 5/0.50/30, Terra 2/12).
WITH input AS (
  SELECT
    session_id,
    turn_id,
    parent_turn_id,
    completion_tokens,
    cost_usd,
    cached_tokens,
    CASE
      WHEN COALESCE(cached_tokens, 0) > COALESCE(prompt_tokens, 0)
        THEN COALESCE(prompt_tokens, 0) + COALESCE(cached_tokens, 0)
      ELSE COALESCE(prompt_tokens, 0)
    END AS input_tokens
  FROM inference_calls
),
joined AS (
  SELECT
    t.trial,
    t.arm,
    t.parent_turn_id,
    t.completed,
    t.bound_reason,
    t.wall_clock_s,
    i.input_tokens,
    i.cached_tokens,
    i.completion_tokens,
    i.cost_usd,
    CASE
      WHEN i.parent_turn_id IS NULL AND i.turn_id = t.parent_turn_id THEN 1
      ELSE 0
    END AS is_parent
  FROM ab_trials t
  LEFT JOIN input i
    ON i.turn_id = t.parent_turn_id
    OR i.parent_turn_id = t.parent_turn_id
)
SELECT
  parent_turn_id,
  arm,
  trial,
  MAX(completed) AS completed,
  MAX(bound_reason) AS bound_reason,
  SUM(input_tokens) AS total_prompt_tokens,
  ROUND(SUM(COALESCE(cached_tokens, 0)) * 1.0 / NULLIF(SUM(input_tokens), 0), 4) AS cache_read_share,
  SUM(completion_tokens) AS total_completion_tokens,
  ROUND(SUM(COALESCE(cost_usd, 0)), 6) AS total_cost_usd,
  MAX(wall_clock_s) AS wall_clock_s,
  MAX(CASE WHEN is_parent = 1 THEN input_tokens END) AS peak_parent_prompt_tokens
FROM joined
GROUP BY parent_turn_id, arm, trial
ORDER BY trial;
