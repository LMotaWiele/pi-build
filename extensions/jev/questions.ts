/**
 * Versioned question sets. Each question is decidable from the state alone.
 * The wire format is applied only in adapter.ts.
 */

export type QuestionSpec =
  | { kind: "bool"; instructions: string; yes: string; no: string }
  | { kind: "enum"; instructions: string; options: Record<string, string> };

export function tierSelectQuestions(): Record<string, QuestionSpec> {
  return {
    single_file_edit: {
      kind: "bool",
      instructions: "Is this turn a single-file edit?",
      yes: "One file, a local change.",
      no: "More than one file, or not an edit.",
    },
    needs_repo_reasoning: {
      kind: "bool",
      instructions: "Does the task need reasoning across the repository?",
      yes: "The change depends on callers, neighbors, or invariants outside one file.",
      no: "The edit is local to the named file.",
    },
    unfamiliar_stack: {
      kind: "bool",
      instructions: "Is the stack unfamiliar relative to the state?",
      yes: "The prompt names a language, framework, or API the state does not already show as known.",
      no: "The stack is one the state already treats as familiar.",
    },
    spec_exists: {
      kind: "bool",
      instructions: "Does a spec for this task already exist?",
      yes: "The prompt or state names a spec, ADR, or design doc that covers the change.",
      no: "No spec is mentioned.",
    },
    reversible: {
      kind: "bool",
      instructions: "Is the change reversible?",
      yes: "A later edit can undo it without migrating data or publishing.",
      no: "It publishes, migrates, deletes irreplaceable state, or lands outside the repo.",
    },
  };
}

export function escalateCheckQuestions(): Record<string, QuestionSpec> {
  return {
    claim_supported: {
      kind: "enum",
      instructions: "Is the current claim supported by the state?",
      options: {
        supported: "The state contains evidence for the claim.",
        unsupported: "The state contradicts the claim or lacks the evidence.",
        declined: "The state is not enough to say.",
      },
    },
    tests_cover_change: {
      kind: "bool",
      instructions: "Do tests cover the change described in the state?",
      yes: "A test file or command in the state covers the edited behavior.",
      no: "No covering test is visible.",
    },
    matches_neighbors: {
      kind: "bool",
      instructions: "Does the change match the neighboring code in the state?",
      yes: "The edit follows the patterns of the files named in the state.",
      no: "It introduces a different pattern, or neighbors are not in the state.",
    },
  };
}

export function guardCheckQuestions(): Record<string, QuestionSpec> {
  return {
    violates_do_not: {
      kind: "bool",
      instructions: "Does the planned action violate a Do not entry in the state?",
      yes: "The action matches a Do not line.",
      no: "No Do not line matches.",
    },
    creates_toplevel_dir: {
      kind: "bool",
      instructions: "Does the planned action create a new top-level directory?",
      yes: "A new directory at the repository root is part of the action.",
      no: "No new top-level directory.",
    },
  };
}

export function criteriaEvalQuestions(rows: { if: string }[]): Record<string, QuestionSpec> {
  const questions: Record<string, QuestionSpec> = {};
  rows.forEach((row, index) => {
    questions[`c${index}`] = {
      kind: "bool",
      instructions: `Is this pre-committed condition true? ${row.if}`,
      yes: "The state contains the evidence the condition requires.",
      no: "The condition is not met, or the evidence is absent.",
    };
  });
  return questions;
}

/** Enum values are the INDEX topics present now. An empty index yields a single (none) option. */
export function indexResolveQuestions(topics: string[]): Record<string, QuestionSpec> {
  const options: Record<string, string> = {};
  for (const topic of topics) {
    if (!topic || options[topic]) continue;
    options[topic] = topic;
  }
  if (Object.keys(options).length === 0) options["(none)"] = "No indexed topic.";
  return {
    row: {
      kind: "enum",
      instructions: "Which indexed topic does this turn concern? Pick only from the options.",
      options,
    },
  };
}
