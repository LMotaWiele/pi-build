import type { Reading } from "./types.ts";

export function parseLine(line: string): Reading {
  const parts = line.trim().split(/\s+/);
  if (parts.length !== 3) throw new Error(`expected 3 fields, got ${parts.length}`);
  const [id, label, raw] = parts;
  const value = Number(raw);
  if (!id || !label || !Number.isFinite(value)) throw new Error(`bad reading: ${line}`);
  return { id, label, value };
}

export function parseBatch(text: string): Reading[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map(parseLine);
}
