/**
 * Keys in settings/hosts/example.json that pi 0.99.1 reads itself.
 * Doctor requires every example.json key to appear as a string literal under extensions/ or lib/.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const PI_OWNED_SETTING_KEYS = [
  "defaultProvider",
  "defaultModel",
  "enabledModels",
  "modelThinkingLevels",
  "pipeline",
  "plannerThinking",
  "editorThinking",
  "cacheWarming",
  "defaultProjectTrust",
  "skills",
  "packages",
  "webAccess",
  "workflow",
  "tools",
  "image",
  "pdf",
  "subagent",
  "maxDepth",
  "preventCycles",
  "audit",
  "approval",
  "logPath",
  "logToolArguments",
  "provider/model-id",
] as const;

export function exampleKeys(value: unknown, into = new Set<string>()): Set<string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return into;
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    into.add(key);
    exampleKeys(child, into);
  }
  return into;
}

export function unreadExampleKeys(example: unknown, sources: string): string[] {
  return [...exampleKeys(example)].filter((key) => !sources.includes(`"${key}"`) && !sources.includes(`'${key}'`)).sort();
}

function collect(dir: string): string {
  let out = "";
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules") continue;
      out += collect(full);
    } else if (entry.name.endsWith(".ts")) {
      out += `\n${fs.readFileSync(full, "utf8")}`;
    }
  }
  return out;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const example = JSON.parse(fs.readFileSync(path.join(repo, "settings/hosts/example.json"), "utf8"));
  const sources = collect(path.join(repo, "extensions")) + collect(path.join(repo, "lib"));
  const missing = unreadExampleKeys(example, sources);
  if (missing.length) {
    console.error(`FAIL: unread settings key ${missing[0]}`);
    process.exit(1);
  }
}
