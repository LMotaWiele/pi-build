#!/usr/bin/env node
// List the subagent definitions pi-subagent discovers from this cwd.
// `pi subagent list` is not a subcommand; passing those words to pi starts a session.
// Exit 0 only when a definition can edit and write and cannot dispatch.

import { existsSync, realpathSync } from "node:fs";
import { register } from "node:module";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

function piOnPath() {
  for (const dir of (process.env.PATH ?? "").split(path.delimiter)) {
    if (!dir) continue;
    const candidate = path.join(dir, "pi");
    if (existsSync(candidate)) return candidate;
  }
  throw new Error("pi is not on PATH");
}

function piPackageEntry() {
  let dir = path.dirname(realpathSync(piOnPath()));
  for (let i = 0; i < 8; i++) {
    const entry = path.join(dir, "dist/index.js");
    if (existsSync(path.join(dir, "package.json")) && existsSync(entry)) return entry;
    dir = path.dirname(dir);
  }
  throw new Error("could not find @earendil-works/pi-coding-agent from the pi binary");
}

const entry = piPackageEntry();
const loaderSource = `
export async function resolve(specifier, context, nextResolve) {
  if (specifier === "@earendil-works/pi-coding-agent") {
    return { url: ${JSON.stringify(pathToFileURL(entry).href)}, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
`;
register("data:text/javascript," + encodeURIComponent(loaderSource), { parentURL: import.meta.url });

const agentDir = process.env.PI_CODING_AGENT_DIR?.trim() || path.join(os.homedir(), ".pi", "agent");
const agentsTs = path.join(agentDir, "git/github.com/mjakl/pi-subagent/agents.ts");
const { discoverAgents } = await import(pathToFileURL(agentsTs).href);
const { agents } = discoverAgents(process.cwd(), "both", true);

for (const agent of agents) {
  const tools = (agent.tools ?? []).join(",");
  console.log(`${agent.name} (${agent.source}) tools=${tools || "(inherit)"} ${agent.filePath}`);
}

const writing = agents.filter((agent) => {
  const tools = agent.tools ?? [];
  return tools.includes("edit") && tools.includes("write") && !tools.includes("subagent");
});

if (writing.length === 0) {
  console.error("arm B not runnable: no definition with edit and write, and without subagent");
  process.exit(1);
}
