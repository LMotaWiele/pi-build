import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

export function buildSummary(input: {
  runDir: string;
  outcome: { ok: boolean; stage: string; reason: string; next?: string; landed?: string; branch?: string };
}): string {
  const { runDir, outcome } = input;
  const lines: string[] = [];
  const readJson = (name: string): any => {
    try { return JSON.parse(readFileSync(join(runDir, name), "utf8")); } catch { return undefined; }
  };
  const metadata = readJson("pipeline.json");
  const spec = typeof metadata?.spec === "string" ? metadata.spec : "missing";
  const id = spec.match(/SPEC-[0-9A-Za-z]+/)?.[0] ?? "missing";

  lines.push(`# Run summary: ${id}`, "", "## Status", `**${!outcome.ok ? "Failed" : outcome.landed ? `Landed on ${outcome.landed}` : "Handed off"}**`, `Stage: ${outcome.stage || "missing"}`, `Reason: ${outcome.reason || "missing"}`);
  const keptBranch = !outcome.landed ? (outcome.branch || metadata?.branch) : undefined;
  if (keptBranch) lines.push(`Branch: ${keptBranch}`);
  if (outcome.next) lines.push(`Next: ${outcome.next}`);

  lines.push("", "## Run", `Spec: ${spec}`, `Base: ${typeof metadata?.base === "string" ? metadata.base.slice(0, 7) : "missing"}`, `Base branch: ${metadata?.baseBranch ?? "missing"}`, `Started at: ${metadata?.startedAt ?? "missing"}`, `Run directory: ${runDir}`);

  lines.push("", "## Plan gate");
  let gateFound = false;
  try {
    const gates = readdirSync(runDir).map((name) => ({ name, match: /^gate-(\d+)\.log$/.exec(name) }))
      .filter((item) => item.match).sort((a, b) => Number(a.match![1]) - Number(b.match![1]));
    for (const gate of gates) {
      gateFound = true;
      let content = "missing";
      try { content = readFileSync(join(runDir, gate.name), "utf8").trim() || "(empty)"; } catch { /* report missing */ }
      lines.push(`- Gate round ${Number(gate.match![1]) + 1}: ${content}`);
    }
  } catch { /* missing directory */ }
  const gate = readJson("gate.json");
  if (gate?.result === "pass") { lines.push("- Passed"); gateFound = true; }
  if (!gateFound) lines.push("- not reached (missing gate files)");

  lines.push("", "## Tasks");
  let resultRows = 0;
  try {
    const content = readFileSync(join(runDir, "results.jsonl"), "utf8");
    for (const row of content.split(/\r?\n/)) {
      if (!row.trim()) continue;
      try {
        const task = JSON.parse(row);
        lines.push(`- ${task.id ?? "missing"}: ${task.acceptance ?? "missing"}; ${task.model ?? "missing"}; rounds ${task.rounds ?? "missing"}; cost $${Number(task.providerCost ?? 0).toFixed(2)}`);
        resultRows++;
      } catch { lines.push(`- missing (invalid results row)`); resultRows++; }
    }
  } catch { /* missing results file */ }
  if (!resultRows) lines.push("- none recorded");

  lines.push("", "## Final grade");
  const grade = readJson("grade.json");
  if (!grade) lines.push("- Grade not reached");
  for (const [key, label] of [["specTests", "spec tests"], ["planTests", "plan tests"], ["typecheck", "typecheck"]] as const) {
    if (grade) {
      const code = grade[key]?.code;
      lines.push(`- ${label}: ${code === 0 ? "pass" : typeof code === "number" ? "fail" : "not run"}`);
    }
  }

  lines.push("", "## Sessions", "| Session | Calls | Prompt tokens | Completion tokens | Cost |", "|---|---:|---:|---:|---:|");
  const databases: string[] = [];
  const walk = (dir: string): void => {
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (entry.name !== "branch" && entry.name !== "work") walk(join(dir, entry.name));
      } else if (entry.isFile() && entry.name.endsWith("telemetry.db")) databases.push(join(dir, entry.name));
    }
  };
  walk(runDir);
  databases.sort((a, b) => relative(runDir, a).localeCompare(relative(runDir, b)));
  let calls = 0, prompt = 0, completion = 0, cost = 0;
  for (const file of databases) {
    let db: DatabaseSync | undefined;
    try {
      db = new DatabaseSync(file, { readOnly: true });
      const row: any = db.prepare("SELECT COUNT(*) AS calls, COALESCE(SUM(prompt_tokens),0) AS prompt, COALESCE(SUM(completion_tokens),0) AS completion, COALESCE(SUM(cost_usd),0) AS cost FROM inference_calls").get();
      const n = Number(row.calls), p = Number(row.prompt), c = Number(row.completion), dollars = Number(row.cost);
      calls += n; prompt += p; completion += c; cost += dollars;
      const fileName = basename(file);
      const name = fileName.endsWith("-telemetry.db") ? fileName.slice(0, -"-telemetry.db".length) : fileName;
      lines.push(`| ${name} | ${n} | ${p} | ${c} | $${dollars.toFixed(2)} |`);
    } catch {
      // An unreadable or incompatible database is surfaced as missing evidence.
      lines.push(`| ${basename(file).replace(/-telemetry\.db$/, "")} | missing | missing | missing | missing |`);
    } finally { db?.close(); }
  }
  lines.push(`| Total | ${calls} | ${prompt} | ${completion} | $${cost.toFixed(2)} |`);

  if (existsSync(join(runDir, "report.md"))) lines.push("", "## Integration report", resolve(runDir, "report.md"));
  return `${lines.join("\n")}\n`;
}
