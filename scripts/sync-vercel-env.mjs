#!/usr/bin/env node
/**
 * Sync .env.local vars to linked Vercel project (production, preview, development).
 * Usage: node scripts/sync-vercel-env.mjs
 */
import { readFileSync, existsSync } from "fs";
import { spawnSync } from "child_process";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const vercel = resolve(root, "node_modules/.bin/vercel");

function loadEnv(path) {
  const vars = {};
  if (!existsSync(path)) throw new Error(`Missing ${path}`);
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    vars[k] = v;
  }
  return vars;
}

const local = loadEnv(resolve(root, ".env.local"));
const PRODUCTION_URL =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
  "https://train-app-three.vercel.app";

const vars = {
  ...local,
  POKPAY_ENV: "staging",
  NEXT_PUBLIC_POKPAY_ENV: "staging",
};

const productionOnly = {
  NEXT_PUBLIC_APP_URL: PRODUCTION_URL,
  NEXT_PUBLIC_SITE_URL: PRODUCTION_URL,
};

const sensitive = new Set([
  "SUPABASE_SERVICE_ROLE_KEY",
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "POKPAY_KEY_SECRET",
]);

const targets = ["production", "preview", "development"];

function addEnv(name, value, target) {
  const args = ["env", "add", name, target, "--value", value, "--yes", "--force"];
  if (sensitive.has(name) && target !== "development") args.push("--sensitive");
  const res = spawnSync(vercel, args, { cwd: root, encoding: "utf8" });
  const out = `${res.stdout ?? ""}${res.stderr ?? ""}`;
  const ok =
    res.status === 0 ||
    /Updated Environment Variable|Added Environment Variable/i.test(out);
  return { ok, out: out.trim() };
}

let okCount = 0;
let failCount = 0;

for (const target of targets) {
  for (const [name, value] of Object.entries(vars)) {
    if (!value) continue;
    const { ok, out } = addEnv(name, value, target);
    console.log(`${ok ? "✓" : "✗"} ${name} (${target})`);
    if (!ok) console.log(`  ${out.slice(-300)}`);
    ok ? okCount++ : failCount++;
  }
  if (target === "production") {
    for (const [name, value] of Object.entries(productionOnly)) {
      const { ok, out } = addEnv(name, value, target);
      console.log(`${ok ? "✓" : "✗"} ${name} (${target})`);
      if (!ok) console.log(`  ${out.slice(-300)}`);
      ok ? okCount++ : failCount++;
    }
  }
}

console.log(`\nFinished: ${okCount} ok, ${failCount} failed`);
process.exit(failCount > 0 ? 1 : 0);
