import type { Row } from "./sample.ts";

export interface ViewProps {
  row: Row;
}

export function View(props: ViewProps) {
  return <div>{props.row.name}</div>;
}
