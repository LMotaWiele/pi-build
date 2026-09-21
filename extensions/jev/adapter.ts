/**
 * The only file that knows Jev's URL, model slug, and error shape.
 * Fail open. A decision that can stall a turn is worse than no decision.
 */

import type { QuestionSpec } from "./questions.ts";

export type Answer = boolean | string | { value: string; confidence?: number };

const DEFAULT_URL = "https://openrouter.ai/api/alpha/decisions";
const DEFAULT_MODEL = "typesafe/jev-1.13";

export interface DecideOptions {
  timeoutMs?: number;
  defaults?: Record<string, Answer>;
  fetchImpl?: typeof fetch;
  apiKey?: string;
  url?: string;
  model?: string;
  sleep?: (ms: number) => Promise<void>;
}

interface NormalizedError {
  code?: string | number;
  message: string;
}

function fallback(questions: Record<string, QuestionSpec>, defaults?: Record<string, Answer>): Record<string, Answer> {
  if (defaults) return { ...defaults };
  const answers: Record<string, Answer> = {};
  for (const [name, question] of Object.entries(questions)) {
    answers[name] = question.kind === "bool" ? false : (Object.keys(question.options)[0] ?? "");
  }
  return answers;
}

function toWire(question: QuestionSpec): Record<string, unknown> {
  if (question.kind === "bool") {
    return {
      type: "noul",
      instructions: question.instructions,
      criteria: { true: question.yes, false: question.no },
    };
  }
  return {
    type: "choice",
    instructions: question.instructions,
    criteria: question.options,
  };
}

export function normalizeErrorBody(body: unknown): NormalizedError {
  if (body && typeof body === "object") {
    const record = body as { error?: { code?: string | number; message?: string }; detail?: unknown };
    if (record.error && typeof record.error === "object") {
      return { code: record.error.code, message: record.error.message || "decision error" };
    }
    if (record.detail !== undefined) {
      return { message: typeof record.detail === "string" ? record.detail : JSON.stringify(record.detail) };
    }
  }
  return { message: "decision error" };
}

function fromWire(value: unknown): Answer | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as { type?: string; noul?: number; choice?: string; confidence?: number };
  if (record.type === "noul" && typeof record.noul === "number") return record.noul >= 0.5;
  if (record.type === "choice" && typeof record.choice === "string") {
    if (typeof record.confidence === "number") return { value: record.choice, confidence: record.confidence };
    return record.choice;
  }
  return undefined;
}

function isTransportStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function decide(
  state: string,
  questions: Record<string, QuestionSpec>,
  opts: DecideOptions = {},
): Promise<Record<string, Answer>> {
  const timeoutMs = opts.timeoutMs ?? 3000;
  const fetchImpl = opts.fetchImpl ?? fetch;
  const sleep = opts.sleep ?? defaultSleep;
  const url = opts.url ?? DEFAULT_URL;
  const model = opts.model ?? DEFAULT_MODEL;
  const apiKey = opts.apiKey ?? process.env.OPENROUTER_API_KEY ?? "";
  const wireQuestions: Record<string, unknown> = {};
  for (const [name, question] of Object.entries(questions)) wireQuestions[name] = toWire(question);

  const once = async (): Promise<{ status: number; body: unknown } | { transport: true; message: string }> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(url, {
        method: "POST",
        headers: {
          authorization: apiKey ? `Bearer ${apiKey}` : "",
          "content-type": "application/json",
        },
        body: JSON.stringify({ model, state, questions: wireQuestions }),
        signal: controller.signal,
      });
      const text = await response.text();
      let body: unknown = text;
      try {
        body = JSON.parse(text);
      } catch {
        body = { detail: text };
      }
      return { status: response.status, body };
    } catch (err) {
      const aborted = err instanceof Error && err.name === "AbortError";
      return { transport: true, message: aborted ? `timeout ${timeoutMs}ms` : err instanceof Error ? err.message : String(err) };
    } finally {
      clearTimeout(timer);
    }
  };

  let attempt = await once();
  const retryable =
    "transport" in attempt ? !attempt.message.startsWith("timeout") : isTransportStatus(attempt.status);
  if (retryable) {
    await sleep(500);
    attempt = await once();
  }

  if ("transport" in attempt) {
    console.error(`[jev] ${JSON.stringify({ message: attempt.message })}`);
    return fallback(questions, opts.defaults);
  }
  if (attempt.status < 200 || attempt.status >= 300) {
    const error = normalizeErrorBody(attempt.body);
    if (error.code === undefined) error.code = attempt.status;
    console.error(`[jev] ${JSON.stringify(error)}`);
    return fallback(questions, opts.defaults);
  }

  const answers: Record<string, Answer> = fallback(questions, opts.defaults);
  const raw = (attempt.body as { answers?: Record<string, unknown> }).answers ?? {};
  for (const name of Object.keys(questions)) {
    const parsed = fromWire(raw[name]);
    if (parsed !== undefined) answers[name] = parsed;
  }
  return answers;
}
