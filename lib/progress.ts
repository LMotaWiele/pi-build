// The JSONL contract between the pipeline runner and the chat tool. Child pi JSON
// events are translated here; only ProgressEvent objects go on runner stdout.
export type ProgressStage = "preflight" | "plan" | "gate" | "tasks" | "integration" | "grade" | "handoff";
export type ProgressRole = "planner" | "editor" | "integration" | "other";

export type ProgressEvent =
  | { type: "stage"; stage: ProgressStage }
  | { type: "task_start"; id: string; title: string; model: string }
  | { type: "task_end"; id: string; pass: boolean; rounds: number; cost: number; result?: string }
  | { type: "activity"; role: string; taskId?: string; tool: string; target: string }
  | { type: "usage"; role: string; taskId?: string; cost: number }
  | { type: "notice"; text: string }
  | { type: "done"; ok: boolean; branch?: string; runRecord?: string; summary?: string };

export interface ProgressTask {
  id: string;
  title: string;
  model: string;
  status: "running" | "pass" | "fail";
  rounds?: number;
  cost?: number;
  result?: string;
}

export interface ProgressState {
  spec: string;
  stage: ProgressStage;
  tasks: ProgressTask[];
  current: { role?: string; taskId?: string; recent: string[] };
  cost: Record<ProgressRole | "total", number>;
  notices: string[];
  done: Extract<ProgressEvent, { type: "done" }> | null;
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function nonnegative(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function optionalString(value: unknown): boolean {
  return value === undefined || typeof value === "string";
}

const STAGES: readonly string[] = ["preflight", "plan", "gate", "tasks", "integration", "grade", "handoff"];

// A bad/stray stdout line must never turn into UI state.
export function parseProgressLine(line: string): ProgressEvent | null {
  let value: unknown;
  try {
    value = JSON.parse(line);
  } catch {
    return null;
  }
  if (!record(value)) return null;
  switch (value.type) {
    case "stage":
      return typeof value.stage === "string" && STAGES.includes(value.stage) ? value as ProgressEvent : null;
    case "task_start":
      return typeof value.id === "string" && typeof value.title === "string" && typeof value.model === "string"
        ? value as ProgressEvent : null;
    case "task_end":
      return typeof value.id === "string" && typeof value.pass === "boolean" && nonnegative(value.rounds) &&
        Number.isInteger(value.rounds) && nonnegative(value.cost) && optionalString(value.result)
        ? value as ProgressEvent : null;
    case "activity":
      return typeof value.role === "string" && optionalString(value.taskId) &&
        typeof value.tool === "string" && typeof value.target === "string" ? value as ProgressEvent : null;
    case "usage":
      return typeof value.role === "string" && optionalString(value.taskId) && nonnegative(value.cost)
        ? value as ProgressEvent : null;
    case "notice":
      return typeof value.text === "string" ? value as ProgressEvent : null;
    case "done":
      return typeof value.ok === "boolean" && optionalString(value.branch) &&
        optionalString(value.runRecord) && optionalString(value.summary) ? value as ProgressEvent : null;
    default:
      return null;
  }
}

function clipped(value: string): string {
  return value.length <= 80 ? value : `${value.slice(0, 79)}…`;
}

// Pi 0.99 JSON mode emits assistant messages on message_end, and extension UI
// notifications separately. Text and tool results are not activity events.
export function childEventToProgress(role: string, taskId: string | undefined, event: unknown): ProgressEvent[] {
  if (!record(event)) return [];
  if (event.type === "extension_ui_request") {
    return event.method === "notify" && typeof event.message === "string"
      ? [{ type: "notice", text: event.message }] : [];
  }
  if (event.type !== "message_end" || !record(event.message) || event.message.role !== "assistant") return [];
  const message = event.message;
  const events: ProgressEvent[] = [];
  if (Array.isArray(message.content)) {
    for (const part of message.content) {
      if (!record(part) || part.type !== "toolCall" || typeof part.name !== "string") continue;
      const args: Record<string, unknown> = record(part.arguments) ? part.arguments : {};
      const target = [args.path, args.file_path, args.command, args.cmd, args.url]
        .find((candidate) => typeof candidate === "string");
      events.push({ type: "activity", role, ...(taskId === undefined ? {} : { taskId }),
        tool: part.name, target: clipped(typeof target === "string" ? target : "") });
    }
  }
  if (record(message.usage) && record(message.usage.cost) && nonnegative(message.usage.cost.total)) {
    events.push({ type: "usage", role, ...(taskId === undefined ? {} : { taskId }), cost: message.usage.cost.total });
  }
  return events;
}

export function initialProgress(spec: string): ProgressState {
  return {
    spec, stage: "preflight", tasks: [], current: { recent: [] },
    cost: { planner: 0, editor: 0, integration: 0, other: 0, total: 0 },
    notices: [], done: null,
  };
}

export function reduceProgress(state: ProgressState, event: ProgressEvent): ProgressState {
  switch (event.type) {
    case "stage": return { ...state, stage: event.stage };
    case "task_start": {
      const task: ProgressTask = { id: event.id, title: event.title, model: event.model, status: "running" };
      const index = state.tasks.findIndex((entry) => entry.id === event.id);
      const tasks = [...state.tasks];
      if (index < 0) tasks.push(task);
      else tasks[index] = task;
      return { ...state, tasks, current: { ...state.current, taskId: event.id } };
    }
    case "task_end":
      return { ...state, tasks: state.tasks.map((task) => task.id === event.id
        ? { ...task, status: event.pass ? "pass" as const : "fail" as const,
          rounds: event.rounds, cost: event.cost, result: event.result } : task) };
    case "activity": {
      const line = `${event.role}${event.taskId ? ` ${event.taskId}` : ""}: ${event.tool}${event.target ? ` ${event.target}` : ""}`;
      return { ...state, current: { role: event.role, taskId: event.taskId,
        recent: [...state.current.recent, line].slice(-8) } };
    }
    case "usage": {
      const role: ProgressRole = event.role === "planner" || event.role === "editor" || event.role === "integration"
        ? event.role : "other";
      return { ...state, cost: { ...state.cost, [role]: state.cost[role] + event.cost,
        total: state.cost.total + event.cost },
        current: { ...state.current, role: event.role, taskId: event.taskId } };
    }
    case "notice": return { ...state, notices: [...state.notices, event.text] };
    case "done": return { ...state, done: event };
  }
}

function money(value: number): string {
  return `$${value.toFixed(2)}`;
}

export function renderProgress(state: ProgressState, expanded: boolean): string[] {
  const passed = state.tasks.filter((task) => task.status === "pass").length;
  const headline = `${state.spec} · ${state.stage} · ${passed}/${state.tasks.length} tasks · ${money(state.cost.total)}`;
  if (!expanded) {
    const latest = state.done?.summary ?? state.notices.at(-1) ?? state.current.recent.at(-1);
    return latest ? [headline, latest] : [headline];
  }
  return [headline,
    ...state.tasks.map((task) => `${task.id} ${task.title} (${task.model}) — ${task.status}${task.rounds === undefined ? "" : `, ${task.rounds} rounds`}${task.result ? `: ${task.result}` : ""}`),
    ...state.current.recent,
    ...state.notices.map((notice) => `Notice: ${notice}`),
    ...(state.done ? [state.done.ok ? "Handed off" : "Failed", ...(state.done.branch ? [`Branch: ${state.done.branch}`] : []),
      ...(state.done.runRecord ? [`Run record: ${state.done.runRecord}`] : [])] : []),
  ];
}

export function progressSummary(state: ProgressState): string {
  const status = state.done ? (state.done.ok ? "Handed off" : "Failed") : `Running ${state.stage}`;
  const passed = state.tasks.filter((task) => task.status === "pass").length;
  const cost = state.cost;
  return [
    `${state.spec}: ${status} (${passed}/${state.tasks.length} tasks).`,
    state.done?.summary,
    state.done?.branch && `Branch: ${state.done.branch}`,
    state.done?.runRecord && `Run record: ${state.done.runRecord}`,
    `Cost: planner ${money(cost.planner)}, editor ${money(cost.editor)}, integration ${money(cost.integration)}, other ${money(cost.other)}, total ${money(cost.total)}.`,
  ].filter((part): part is string => typeof part === "string" && part.length > 0).join("\n");
}

// The last assistant message, not the last JSON event (often agent_end), is the
// child's final reply. Tool calls and malformed/interleaved log lines are ignored.
export function finalText(log: string): string {
  let text = "";
  for (const line of log.split(/\r?\n/)) {
    let event: unknown;
    try { event = JSON.parse(line); } catch { continue; }
    if (!record(event) || event.type !== "message_end" || !record(event.message) ||
      event.message.role !== "assistant" || !Array.isArray(event.message.content)) continue;
    const parts = event.message.content.filter((part): part is Record<string, unknown> =>
      record(part) && part.type === "text" && typeof part.text === "string");
    text = parts.map((part) => part.text).join("");
  }
  return text;
}
