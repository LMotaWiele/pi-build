// Append to lib/plan.ts.
/**
 * Number of verification checks in a spec: the V-IDs defined in the §8 table of
 * the spec-loop template, or the older numbered "Verify" list. Throws when
 * neither exists or V-IDs are not contiguous, so the plan gate cannot pass empty.
 */
export function countVerifyChecks(specText: string): number {
  const sections = specText.split(/^## /m);
  const table = sections.find((s) => /^\d+\.\s+Verification\b/.test(s));
  if (table) {
    const ids = [...table.matchAll(/^\|[^|\n]*\|[^|\n]*\|\s*V(\d+)\s*:/gm)].map((m) => Number(m[1]));
    if (ids.length) {
      const max = Math.max(...ids);
      const missing = Array.from({ length: max }, (_, i) => i + 1).filter((n) => !ids.includes(n));
      if (missing.length) throw new Error(`V-IDs are not contiguous: missing ${missing.map((n) => `V${n}`).join(", ")}`);
      return max;
    }
  }
  const list = sections.reverse().find((s) => /^(\d+\.\s+)?Verify\b/.test(s));
  if (list) {
    const body = list.slice(list.indexOf("\n") + 1); // skip the "8. Verify" heading itself
    const nums = [...body.matchAll(/^(\d+)\. /gm)].map((m) => Number(m[1]));
    if (nums.length) return Math.max(...nums);
  }
  throw new Error("spec has no verification checks: expected a §8 Verification table or a numbered Verify list");
}
