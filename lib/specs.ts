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

// Sibling paths, relative to /docs/specs.
export function specPaths(spec: SpecRef): { spec: string; tests: string; plan: string; runRecord: string } {
  const stem = spec.file.replace(/\.md$/, "");
  return { spec: spec.file, tests: `${stem}.tests`, plan: `${stem}.plan`, runRecord: `SPEC-${spec.id}-run.md` };
}
