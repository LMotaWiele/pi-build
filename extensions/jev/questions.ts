/**
 * Battery answered from the prompt plus the handoff.
 * On any decision failure the caller passes SAFE_DEFAULTS, and the route stays off Luna solo.
 */

export type QuestionSpec =
  | { kind: "bool"; instructions: string; yes: string; no: string }
  | { kind: "enum"; instructions: string; options: Record<string, string> };

function bool(instructions: string, yes: string, no: string): QuestionSpec {
  return { kind: "bool", instructions, yes, no };
}

export function batteryQuestions(): Record<string, QuestionSpec> {
  return {
    V1: bool(
      "Does every requirement in the checklist map to an existing test or a specified new test?",
      "Every requirement's check line is an existing test or a new test.",
      "At least one requirement says no check exists, or there is no checklist.",
    ),
    V2: bool(
      "Does the task set a numeric value, threshold, limit, or default?",
      "The prompt or checklist states a number that the change must set.",
      "No numeric value, threshold, limit, or default is stated.",
    ),
    V3: bool(
      "If the task sets a numeric value, does any listed check constrain that value's magnitude, not just its sign or presence? If the task sets no numeric value, answer yes.",
      "No numeric value is set, or a listed check requires the specific magnitude.",
      "A numeric value is set and every listed check ignores its magnitude.",
    ),
    V4: bool(
      "Could a plausible wrong implementation pass every listed check?",
      "The listed checks would still pass if a requirement were implemented wrong.",
      "The listed checks would fail a plausible wrong implementation of each requirement.",
    ),
    B1: bool(
      "Does the handoff fan-in report any symbol with an outside-implicated count greater than zero?",
      "A fan-in line shows an outside-implicated count above zero.",
      "Fan-in is none, or every outside-implicated count is zero.",
    ),
    B2: bool(
      "Does the handoff list a shared surface: a section key, a hook registration, a settings key, or an exported type?",
      "The shared list names at least one section, hook, setting, or type.",
      "The shared list is none.",
    ),
    B3: bool(
      "Could a wrong change fail at runtime in a way the listed tests do not exercise, such as load order, process lifecycle, or a subprocess?",
      "A listed requirement can fail at runtime without a listed test covering that failure.",
      "Every runtime-sensitive requirement in the checklist has a listed test that would catch it.",
    ),
    J1: bool(
      "Does the prompt or spec leave a design choice open between approaches?",
      "Two or more approaches would satisfy the stated requirements.",
      "The requirements name one approach.",
    ),
    J2: bool(
      "Do any two requirements potentially conflict?",
      "Satisfying one stated requirement can break another.",
      "The stated requirements can all be true together.",
    ),
    S1: bool(
      "Does the task create a file under extensions/, lib/, or settings/?",
      "The prompt or the named-missing list names a new file in one of those directories.",
      "No new file in those directories is named.",
    ),
    S2: bool(
      "Does the prompt name two or more numbered spec sections or stages, such as §3 and §4? A settings section key, or the word section with no number, does not count.",
      "The prompt names two or more numbered spec sections or stages, such as §3 and §4.",
      "The prompt names fewer than two numbered spec sections or stages. A section key or an unnumbered section does not count.",
    ),
    S3: bool(
      "Does the task use an API or package that is not used in any implicated file?",
      "The prompt names an API or package that the implicated files do not already use.",
      "Every named API or package appears in an implicated file, or none is named.",
    ),
    R1: bool(
      "Is the change confined to version-controlled files, with no install, network, or data side effect?",
      "The task only edits repository files and does not install, fetch, publish, or change data outside the repository.",
      "The task installs a package, uses the network, publishes, or changes data outside the repository.",
    ),
  };
}

export const DETERMINISTIC_IDS = ["S1", "S2", "B1", "B2", "R1"] as const;

/** Failure answers. A no on V1 or V3, or a yes on V4, B1, B3, or J1, keeps the route off Luna solo. */
export const SAFE_DEFAULTS: Record<string, boolean> = {
  V1: false,
  V2: true,
  V3: false,
  V4: true,
  B1: true,
  B2: true,
  B3: true,
  J1: true,
  J2: true,
  S1: true,
  S2: true,
  S3: true,
  R1: false,
};
