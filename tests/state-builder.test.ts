import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { buildState, type TurnContext } from "../extensions/jev/state-builder.ts";
import { criteriaEvalQuestions, indexResolveQuestions } from "../extensions/jev/questions.ts";
import { normalizeErrorBody } from "../extensions/jev/adapter.ts";
import { estimateTokens } from "../lib/telemetry.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixtures = path.join(root, "extensions/jev/fixtures");

function assertProjection(text: string, ctx: TurnContext): void {
  assert.ok(estimateTokens(text) <= 4000, `over budget: ${estimateTokens(text)}`);
  const promptAt = text.indexOf("user_prompt:");
  const loopAt = text.indexOf("loop_index:");
  assert.ok(promptAt >= 0 && promptAt < loopAt);
  assert.match(text, new RegExp(`loop_index: ${ctx.loopIndex}`));
  assert.match(text, new RegExp(`tier: ${ctx.tier}`));
  assert.equal(text.includes("rawInput"), false);
  assert.equal(text.includes("TodosUpdated"), false);
  const prompt = text.split("loop_index:")[0];
  assert.ok(estimateTokens(prompt) <= 1000);
  if (ctx.tools.length) {
    const tools = text.split("tools:\n")[1]?.split("\n\n")[0] ?? "";
    for (const line of tools.split("\n")) {
      if (!line.startsWith("- ")) continue;
      assert.equal(line.includes("{"), false);
    }
  }
}

test("fixture projections match and stay inside the budget", () => {
  const inputs = fs.readdirSync(fixtures).filter((name) => name.endsWith(".input.json")).sort();
  assert.equal(inputs.length, 12);
  for (const name of inputs) {
    const ctx = JSON.parse(fs.readFileSync(path.join(fixtures, name), "utf8")) as TurnContext;
    const text = buildState(ctx, 4000);
    const expectedPath = path.join(fixtures, name.replace(".input.json", ".expected.txt"));
    const expected = fs.readFileSync(expectedPath, "utf8");
    assert.equal(text, expected, name);
    assertProjection(text, ctx);
  }
});

test("over-budget state drops files_read first and keeps the prompt header", () => {
  const ctx: TurnContext = {
    userPrompt: "P".repeat(5000),
    loopIndex: 3,
    elapsedMs: 10,
    tier: "work",
    tools: Array.from({ length: 40 }, (_, i) => ({ name: "read", outcome: "success", path: `f${i}.ts ${"x".repeat(200)}` })),
    filesWritten: ["w.ts"],
    indexRow: "row",
    currentClaim: "C".repeat(3000),
    lastToolResult: "R".repeat(4000),
    filesRead: Array.from({ length: 40 }, (_, i) => `r${i}.ts ${"y".repeat(200)}`),
  };
  const text = buildState(ctx, 4000);
  assert.ok(estimateTokens(text) <= 4000);
  assert.equal(text.includes("files_read:"), false);
  assert.match(text, /user_prompt:/);
  assert.match(text, /loop_index: 3/);
  assert.ok(text.split("user_prompt:\n")[1].split("\n\n")[0].length <= 4000);
});

test("question sets are built from the live index and the open note", () => {
  const questions = indexResolveQuestions(["Alpha", "Beta"]);
  assert.deepEqual(Object.keys(questions.row.kind === "enum" ? questions.row.options : {}), ["Alpha", "Beta"]);
  const criteria = criteriaEvalQuestions([{ if: "a send is observed" }]);
  assert.match(criteria.c0.kind === "bool" ? criteria.c0.instructions : "", /a send is observed/);
  const empty = indexResolveQuestions([]);
  assert.ok(empty.row.kind === "enum" && empty.row.options["(none)"]);
});

test("error bodies from both vendors normalize to one shape", () => {
  assert.deepEqual(normalizeErrorBody({ error: { code: 401, message: "No cookie auth credentials found" } }), {
    code: 401,
    message: "No cookie auth credentials found",
  });
  assert.deepEqual(normalizeErrorBody({ detail: "bad model" }), { message: "bad model" });
});
