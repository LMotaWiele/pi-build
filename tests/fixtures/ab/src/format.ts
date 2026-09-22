import type { Reading } from "./types.ts";

export function formatReading(reading: Reading): string {
  return `${reading.id} ${reading.label} ${reading.value}`;
}

export function formatBatch(readings: Reading[]): string {
  return readings.map(formatReading).join("\n");
}
