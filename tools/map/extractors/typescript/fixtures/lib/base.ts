export interface Shape {
  kind: "circle" | "square";
  size: number;
}

export abstract class Base {
  created: number = Date.now();
}
