export function pick(a: number, b: number): number {
  if (a > b) return a;
  return b;
}

export class Counter {
  n = 0;
  add(k: number): number {
    for (let i = 0; i < k; i++) this.n += i % 2 === 0 ? 1 : 2;
    return this.n;
  }
}

export const twice = (x: number) => x * 2;
