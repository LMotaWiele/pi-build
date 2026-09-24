import assert from "node:assert/strict";
import test from "node:test";
import { decide } from "../extensions/jev/adapter.ts";
import { batteryQuestions, DETERMINISTIC_IDS, SAFE_DEFAULTS } from "../extensions/jev/questions.ts";

test("the battery is the thirteen questions and the five deterministic ids", () => {
  const names = Object.keys(batteryQuestions());
  assert.deepEqual(names, ["V1", "V2", "V3", "V4", "B1", "B2", "B3", "J1", "J2", "S1", "S2", "S3", "R1"]);
  assert.deepEqual([...DETERMINISTIC_IDS], ["S1", "S2", "B1", "B2", "R1"]);
});

test("a transport failure returns the safe defaults", async () => {
  const answers = await decide("prompt plus handoff", batteryQuestions(), {
    defaults: SAFE_DEFAULTS,
    fetchImpl: async () => {
      throw new Error("down");
    },
    sleep: async () => {},
  });
  assert.equal(answers.V1, false);
  assert.equal(answers.V3, false);
  assert.equal(answers.V4, true);
  assert.equal(answers.B1, true);
  assert.equal(answers.J1, true);
  assert.equal(answers.R1, false);
});
