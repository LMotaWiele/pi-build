import fs from "node:fs";
import path from "node:path";
import { Base, type Shape } from "./lib/base.ts";

export interface Named {
  name: string;
}

export interface Row extends Named {
  id: number;
  shape: Shape | null;
  tags?: string[];
  children: Array<Row>;
  extra: Partial<Meta>;
  byKey: Record<string, Meta>;
}

type Meta = {
  created: number;
  owner: Named;
};

enum Color {
  Red,
  Green = "green",
}

export class Store extends Base implements Named {
  name = "store";
  private file: string;

  constructor(file: string) {
    super();
    this.file = file;
  }

  save(row: Row): void {
    fs.writeFileSync(this.file, JSON.stringify(row));
    db.prepare(`INSERT INTO rows (id, name) VALUES (?, ?)`).run(row.id, row.name);
  }

  load(): Row[] {
    if (!fs.existsSync(this.file)) return [];
    return db.prepare("SELECT * FROM rows r JOIN tags t ON t.row_id = r.id").all() as Row[];
  }
}

export function openStore(dir: string): Store {
  fs.mkdirSync(dir, { recursive: true });
  return new Store(path.join(dir, "rows.json"));
}

export const reset = (file: string): void => {
  fs.rmSync(file, { force: true });
};

declare const db: { prepare(sql: string): { run(...a: unknown[]): void; all(): unknown[] } };
