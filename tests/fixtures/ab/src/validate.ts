import type { Reading } from "./types.ts";

export function validateReading(reading: Reading): string[] {
  const errors: string[] = [];
  if (!/^[a-z][a-z0-9-]*$/.test(reading.id)) errors.push(`bad id ${reading.id}`);
  if (!reading.label.trim()) errors.push("empty label");
  if (!Number.isFinite(reading.value)) errors.push("value is not finite");
  return errors;
}

export function validateAll(readings: Reading[]): string[] {
  return readings.flatMap(validateReading);
}
