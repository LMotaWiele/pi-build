import type { Batch, Reading } from "./types.ts";

export function emptyBatch(): Batch {
  return { readings: [] };
}

export function addReading(batch: Batch, reading: Reading): Batch {
  return { readings: [...batch.readings, reading] };
}

export function describe(reading: Reading): string {
  return reading.label;
}
