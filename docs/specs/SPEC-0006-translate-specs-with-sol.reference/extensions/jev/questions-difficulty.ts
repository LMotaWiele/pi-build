// extensions/jev/questions-difficulty.ts — asked of each task brief before dispatch.
// Every question is a fact about the brief, the plan, or the repository.
// `anchor: "script"` means a script can compute the true answer, which is how
// Jev's answer accuracy is measured on this battery.

export interface JevQuestion {
  id: string;
  text: string;
  anchor: "script" | null;
}

export const DIFFICULTY_QUESTIONS: JevQuestion[] = [
  { id: "D1", text: "Does the brief name every symbol that the task's acceptance test imports?", anchor: "script" },
  { id: "D2", text: "Does the brief name every file the task needs to read?", anchor: null },
  { id: "D3", text: "Does the brief state the value of every numeric constant the task introduces?", anchor: null },
  { id: "D4", text: "Does the brief leave a choice between two or more approaches unresolved?", anchor: null },
  { id: "D5", text: "Does the brief restate a spec sentence that has more than one plausible reading?", anchor: null },
  { id: "D6", text: "Does the target file export symbols that files outside this task import?", anchor: "script" },
  { id: "D7", text: "Does the task change the signature of an existing exported function?", anchor: null },
  { id: "D8", text: "Does the task touch a section key, a hook registration, a settings key, or an exported type?", anchor: null },
  { id: "D9", text: "Does this task depend on the output of another task in the plan?", anchor: "script" },
  { id: "D10", text: "Does another task in the plan depend on this task's output?", anchor: "script" },
  { id: "D11", text: "Does the task create a new file?", anchor: "script" },
  { id: "D12", text: "Does the task change process lifecycle, subprocesses, environment variables, or files outside the repository?", anchor: null },
  { id: "D13", text: "Does the task use an API or package that the target file does not already use?", anchor: null },
  { id: "D14", text: "Does the acceptance test check a sequence of calls rather than one call and its return value?", anchor: null },
  { id: "D15", text: "Does the task require handling an error or failure path?", anchor: null },
];
