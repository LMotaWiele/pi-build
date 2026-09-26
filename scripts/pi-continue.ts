// scripts/pi-continue.ts — confirm continuation after a quota hold, from outside pi.
// Never reads or refreshes credentials. pi polls usage again at its next
// session_start and re-holds by itself if the window is still over threshold.
//
//   bin/pi-continue          show the hold, ask y/N
//   bin/pi-continue --yes    confirm without asking
//   bin/pi-continue --status show the hold and exit (0 = no hold, 75 = held)

import { createInterface } from "node:readline/promises";
import {
  clearHold,
  continuationFor,
  defaultHoldPath,
  defaultOverridePath,
  readHold,
  readOverrides,
  writeOverrides,
} from "../lib/quota.ts";

const env = process.env as Record<string, string | undefined>;
const holdPath = defaultHoldPath(env);
const overridePath = defaultOverridePath(env);
const args = new Set(process.argv.slice(2));

const hold = readHold(holdPath);
if (!hold) {
  console.log("No quota hold.");
  process.exit(0);
}

const nowSec = Date.now() / 1000;
console.log(`Hold: ${hold.reason} (${hold.hard ? "provider refused" : "threshold reached"}) since ${hold.setAt || "unknown"}`);
for (const w of hold.windows) {
  const reset = w.resetAt ? new Date(w.resetAt * 1000).toLocaleString() : "unknown";
  const passed = w.resetAt && w.resetAt <= nowSec ? " — reset time has passed" : "";
  console.log(`  ${w.label.padEnd(6)} ${String(w.usedPercent).padStart(3)}%  resets ${reset}${passed}`);
}

if (args.has("--status")) process.exit(75);

let ok = args.has("--yes");
if (!ok) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  ok = /^y(es)?$/i.test((await rl.question("Continue? [y/N] ")).trim());
  rl.close();
}
if (!ok) {
  console.log("Still on hold.");
  process.exit(1);
}

const c = continuationFor(hold, nowSec);
clearHold(holdPath);
if (c.override) {
  writeOverrides(overridePath, [...readOverrides(overridePath), c.override]);
  console.log(`Threshold for ${c.override.label} suspended until ${new Date(c.override.until * 1000).toLocaleString()}.`);
}
if (c.warning) console.log(`Warning: ${c.warning}`);
console.log("Hold cleared.");
