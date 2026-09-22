export interface Reading {
  id: string;
  label: string;
  value: number;
}

export interface Batch {
  readings: Reading[];
}
