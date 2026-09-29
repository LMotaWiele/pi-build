// The runner's plan gate maps every verification check to requirements.
// It must count checks in both the spec-loop template (§8 table of V-IDs)
// and the older numbered "Verify" list, and never silently return 0.
import { test } from "node:test";
import assert from "node:assert/strict";
import { countVerifyChecks } from "../../../lib/plan.ts";

const TEMPLATE = `# SPEC-0001: x

## 7. Paths
| happy | x | V2 |

## 8. Verification
| Outcome | Change | Check ID: falsifiable condition |
|---|---|---|
| O1 | §6.1 | V1: a |
| O1 | §6.1 | V2: b |
| O2 | §6.2 | V4: d |
| O2 | §6.2 | V3: c |

You write and run the commands. See V9 in the appendix.

## 9. Stop conditions and repairs
Rerun V1 after a repair.
`;

test("template format: counts the V-IDs defined in the §8 table", () => {
  assert.equal(countVerifyChecks(TEMPLATE), 4);
});

test("template format: V-IDs mentioned outside the §8 table rows are not counted", () => {
  // V9 appears in §8 prose, V2 in §7, V1 in §9; none adds a check.
  assert.equal(countVerifyChecks(TEMPLATE), 4);
});

test("template format: non-contiguous V-IDs are an error, not a silent count", () => {
  const gap = TEMPLATE.replace("| O2 | §6.2 | V3: c |", "| O2 | §6.2 | V6: c |");
  assert.throws(() => countVerifyChecks(gap), /V3|V5|contiguous/);
});

test("older format: counts the numbered Verify list", () => {
  assert.equal(countVerifyChecks("# S\n\n## 8. Verify\n\n1. a\n2. b\n3. c\n\n## 9. Next\n"), 3);
});

test("a spec with neither is an error, never 0", () => {
  assert.throws(() => countVerifyChecks("# S\n\n## 1. Intent\nnothing\n"), /verification/i);
});
