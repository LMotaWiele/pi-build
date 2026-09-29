// extensions/jev/questions-quality.ts — asked of each finished task: the brief,
// the task file's diff, and the implementer's final summary.
// These compare texts. None asks whether code is right; execution decides that.
// Q2 is the one C2-style question, kept deliberately to re-test that form on
// Sol-written briefs; expect it to fail validation.

import type { JevQuestion } from "./questions-difficulty.ts";

export const QUALITY_QUESTIONS: JevQuestion[] = [
  { id: "Q1", text: "Does the diff add behaviour that the brief does not ask for?", anchor: null },
  { id: "Q2", text: "Is there an instruction in the brief that no added or changed line addresses?", anchor: null },
  { id: "Q3", text: "Does the diff fix a value in code that the brief says must be configurable?", anchor: null },
  { id: "Q4", text: "Does the implementer's summary claim a change that the diff does not contain?", anchor: null },
  { id: "Q5", text: "Does the diff change lines outside the function or block that the brief names?", anchor: null },
  { id: "Q6", text: "Does the diff introduce a name where the brief uses a different name for the same thing?", anchor: null },
  { id: "Q7", text: "Does the diff catch or silence an error that the brief does not mention?", anchor: null },
  { id: "Q8", text: "Does the diff add a TODO, a stub, a placeholder, or a branch that throws as not implemented?", anchor: "script" },
  { id: "Q9", text: "Does the diff remove or loosen an existing assertion or check?", anchor: null },
  { id: "Q10", text: "Does the diff remove or rename an existing exported symbol?", anchor: "script" },
];
