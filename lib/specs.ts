// lib/specs.ts — find a spec in /docs/specs by ID, slug, file name or path.
// Shared by bin/pi-rework and bin/pi-implement.

export interface SpecRef {
  id: string; // four digits
  slug: string;
  file: string; // SPEC-0007-build-codebase-map.md
}

export type Resolution = { ok: true; spec: SpecRef } | { ok: false; error: string };

const SPEC_FILE = /^SPEC-(\d{4})-([a-z0-9-]+)\.md$/;

export function listSpecs(fileNames: string[]): SpecRef[] {
  return fileNames
    .map((f) => f.match(SPEC_FILE))
    .filter((m): m is RegExpMatchArray => m !== null && m[2] !== "run")
    .map((m) => ({ id: m[1], slug: m[2], file: m[0] }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

// Accepts "7", "0007", "SPEC-0007", the slug, the file name, or a path ending in it.
export function resolveSpec(fileNames: string[], query: string): Resolution {
  const specs = listSpecs(fileNames);
  const q = query.trim().replace(/^.*\//, "").replace(/\.md$/, "");
  const id = q.match(/^(?:SPEC-)?(\d{1,4})$/)?.[1]?.padStart(4, "0");
  const byFile = q.match(/^SPEC-(\d{4})-[a-z0-9-]+$/)?.[1];
  const hits = specs.filter((s) => s.id === id || s.id === byFile || s.slug === q);
  if (hits.length === 1) return { ok: true, spec: hits[0] };
  const list = specs.map((s) => `${s.id} ${s.slug}`).join(", ");
  if (hits.length > 1) return { ok: false, error: `"${query}" matches more than one spec: ${hits.map((s) => s.id).join(", ")}` };
  return { ok: false, error: `No spec "${query}". Specs: ${list || "none"}` };
}

export function markImplemented(
  indexText: string,
  specText: string,
  id: string,
  by: string,
): { index: string; spec: string } {
  const replaceCell = (line: string, cellIndex: number, value: string): string => {
    const cells = [...line.matchAll(/\|([^|]*)/g)];
    const cell = cells[cellIndex];
    if (!cell) return line;
    const content = cell[1];
    const leading = content.match(/^\s*/)?.[0] ?? "";
    const trailing = content.match(/\s*$/)?.[0] ?? "";
    return line.slice(0, cell.index! + 1) + leading + value + trailing + line.slice(cell.index! + 1 + content.length);
  };

  const lines = indexText.split(/(?<=\n)/);
  const matching: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    const row = lines[i].replace(/\r?\n$/, "");
    if (!row.startsWith("|")) continue;
    const cells = [...row.matchAll(/\|([^|]*)/g)];
    if (cells[0]?.[1].trim() === id && /^\d{4}$/.test(cells[0][1].trim())) matching.push(i);
  }
  if (matching.length !== 1) throw new Error(`Expected exactly one index row for ${id}`);
  const indexRow = matching[0];
  let updatedIndex = replaceCell(lines[indexRow], 2, "implemented");
  // Replace the Implemented by cell after the status edit; cell numbering is unchanged.
  const prefix = lines.slice(0, indexRow).join("");
  const changedRow = replaceCell(updatedIndex, 3, by);
  const updatedLines = [...lines];
  updatedLines[indexRow] = changedRow;
  updatedIndex = prefix + updatedLines.slice(indexRow).join("");

  const specLines = specText.split(/(?<=\n)/);
  let inHeaderTable = false;
  let statusLine = -1;
  for (let i = 0; i < specLines.length; i++) {
    const row = specLines[i].replace(/\r?\n$/, "");
    if (row.startsWith("|")) {
      inHeaderTable = true;
      const cells = [...row.matchAll(/\|([^|]*)/g)];
      if (cells[0]?.[1].trim() === "Status") { statusLine = i; break; }
    } else if (inHeaderTable) break;
  }
  if (statusLine >= 0) specLines[statusLine] = replaceCell(specLines[statusLine], 1, "implemented");
  return { index: updatedIndex, spec: specLines.join("") };
}

// Sibling paths, relative to /docs/specs.
export function specPaths(spec: SpecRef): { spec: string; tests: string; plan: string; runRecord: string } {
  const stem = spec.file.replace(/\.md$/, "");
  return { spec: spec.file, tests: `${stem}.tests`, plan: `${stem}.plan`, runRecord: `SPEC-${spec.id}-run.md` };
}
