// lib/plan.ts — structure checks for a Sol-written implementation plan.

export interface PlanRequirement {
  id: string;
  text: string;
}

export interface PlanInterface {
  path: string;
  exports: string[];
}

export interface PlanTask {
  id: string;
  file: string;
  assignee: "luna" | "sol";
  requirements: string[];
  brief: string;
  interfaces: PlanInterface[];
  acceptanceTest: string | null;
  dependsOn: string[];
}

export interface Plan {
  spec: string;
  verifyMap: Record<string, string[] | "process">;
  requirements: PlanRequirement[];
  tasks: PlanTask[];
}

export interface PlanCheck {
  ok: boolean;
  errors: string[];
}

// Error codes, stable prefixes:
//   UNMAPPED_VERIFY <n>             a Verify item 1..n absent from verifyMap
//   VERIFY_UNKNOWN_REQUIREMENT <n>:<id>
//   UNCOVERED_REQUIREMENT <id>      no task lists it
//   UNKNOWN_REQUIREMENT <task>:<id>
//   EMPTY_FILE <task>
//   MISSING_ACCEPTANCE_TEST <task>  luna task without a test
//   UNKNOWN_DEPENDENCY <task>-><id>
//   CYCLE
//   UNORDERED_SHARED_FILE <a>,<b>   two luna tasks on one file, neither reaching the other
export function validatePlan(plan: Plan, verifyCount: number): PlanCheck {
  const errors: string[] = [];
  const reqIds = new Set(plan.requirements.map((r) => r.id));
  const taskIds = new Set(plan.tasks.map((t) => t.id));

  for (let n = 1; n <= verifyCount; n++) {
    const v = plan.verifyMap[String(n)];
    if (v === undefined) {
      errors.push(`UNMAPPED_VERIFY ${n}`);
      continue;
    }
    if (v !== "process") for (const id of v) if (!reqIds.has(id)) errors.push(`VERIFY_UNKNOWN_REQUIREMENT ${n}:${id}`);
  }

  const covered = new Set(plan.tasks.flatMap((t) => t.requirements));
  for (const r of plan.requirements) if (!covered.has(r.id)) errors.push(`UNCOVERED_REQUIREMENT ${r.id}`);

  for (const t of plan.tasks) {
    for (const id of t.requirements) if (!reqIds.has(id)) errors.push(`UNKNOWN_REQUIREMENT ${t.id}:${id}`);
    if (!t.file || !t.file.trim()) errors.push(`EMPTY_FILE ${t.id}`);
    if (t.assignee === "luna" && !t.acceptanceTest) errors.push(`MISSING_ACCEPTANCE_TEST ${t.id}`);
    for (const d of t.dependsOn) if (!taskIds.has(d)) errors.push(`UNKNOWN_DEPENDENCY ${t.id}->${d}`);
  }

  if (hasCycle(plan)) errors.push("CYCLE");

  const luna = plan.tasks.filter((t) => t.assignee === "luna");
  for (let i = 0; i < luna.length; i++) {
    for (let j = i + 1; j < luna.length; j++) {
      const a = luna[i];
      const b = luna[j];
      if (a.file === b.file && !reaches(plan, a.id, b.id) && !reaches(plan, b.id, a.id)) {
        errors.push(`UNORDERED_SHARED_FILE ${a.id},${b.id}`);
      }
    }
  }

  return { ok: errors.length === 0, errors };
}

function deps(plan: Plan, id: string): string[] {
  return plan.tasks.find((t) => t.id === id)?.dependsOn ?? [];
}

// true when `from` depends, directly or transitively, on `to`
function reaches(plan: Plan, from: string, to: string): boolean {
  const seen = new Set<string>();
  const stack = [...deps(plan, from)];
  while (stack.length) {
    const cur = stack.pop()!;
    if (cur === to) return true;
    if (seen.has(cur)) continue;
    seen.add(cur);
    stack.push(...deps(plan, cur));
  }
  return false;
}

function hasCycle(plan: Plan): boolean {
  return plan.tasks.some((t) => reaches(plan, t.id, t.id));
}

// Kahn's algorithm; ties keep the plan's own order. Throws on a cycle.
export function taskOrder(plan: Plan): string[] {
  const ids = plan.tasks.map((t) => t.id);
  const known = new Set(ids);
  const remaining = new Map(plan.tasks.map((t) => [t.id, new Set(t.dependsOn.filter((d) => known.has(d)))]));
  const out: string[] = [];
  while (out.length < ids.length) {
    const next = ids.find((id) => !out.includes(id) && remaining.get(id)!.size === 0);
    if (!next) throw new Error("CYCLE");
    out.push(next);
    for (const set of remaining.values()) set.delete(next);
  }
  return out;
}

// Names a test imports from repository code that no interface declares.
// Only relative specifiers count; node: and package imports are ignored.
export function undeclaredImports(testSource: string, interfaces: PlanInterface[]): string[] {
  const declared = new Set(interfaces.flatMap((i) => i.exports));
  const found = new Set<string>();
  const re = /import\s+(?:type\s+)?\{([\s\S]*?)\}\s+from\s+["']([^"']+)["']/g;
  for (const m of testSource.matchAll(re)) {
    const spec = m[2];
    if (!spec.startsWith("./") && !spec.startsWith("../")) continue;
    for (const raw of m[1].split(",")) {
      const name = raw
        .trim()
        .replace(/^type\s+/, "")
        .split(/\s+as\s+/)[0]
        .trim();
      if (name && !declared.has(name)) found.add(name);
    }
  }
  return [...found].sort();
}
