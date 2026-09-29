import { test } from "node:test";
import assert from "node:assert/strict";
import { DIFFICULTY_QUESTIONS } from "../../extensions/jev/questions-difficulty.ts";
import { QUALITY_QUESTIONS } from "../../extensions/jev/questions-quality.ts";

const JUDGMENT = /\b(hard|harder|difficult|easy|complex|complicated|simple|correct|correctly|good|bad|quality|risky|safe)\b/i;

test("difficulty battery ids and anchors are fixed", () => {
  assert.deepEqual(
    DIFFICULTY_QUESTIONS.map((q) => q.id),
    Array.from({ length: 15 }, (_, i) => `D${i + 1}`),
  );
  assert.deepEqual(
    DIFFICULTY_QUESTIONS.filter((q) => q.anchor === "script").map((q) => q.id),
    ["D1", "D6", "D9", "D10", "D11"],
  );
});

test("quality battery ids and anchors are fixed", () => {
  assert.deepEqual(
    QUALITY_QUESTIONS.map((q) => q.id),
    Array.from({ length: 10 }, (_, i) => `Q${i + 1}`),
  );
  assert.deepEqual(
    QUALITY_QUESTIONS.filter((q) => q.anchor === "script").map((q) => q.id),
    ["Q8", "Q10"],
  );
});

test("every question is a yes/no question about a fact, never a judgment", () => {
  for (const q of [...DIFFICULTY_QUESTIONS, ...QUALITY_QUESTIONS]) {
    assert.ok(q.text.endsWith("?"), `${q.id} must be a question`);
    assert.match(q.text, /^(Does|Is|Are|Can)\b/, `${q.id} must be yes/no`);
    assert.doesNotMatch(q.text, JUDGMENT, `${q.id} asks for a judgment`);
  }
});
