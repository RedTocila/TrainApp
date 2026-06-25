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

const PRODUCTION_URL = "https://train-app-three.vercel.app";

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

function isLocalhostUrl(value) {
  return /localhost|127\.0\.0\.1/i.test(value ?? "");
}

const local = loadEnv(resolve(root, ".env.local"));

const vars = {
  ...local,
  POKPAY_ENV: local.POKPAY_ENV ?? "production",
  NEXT_PUBLIC_POKPAY_ENV: local.NEXT_PUBLIC_POKPAY_ENV ?? local.POKPAY_ENV ?? "production",
};

const remoteDeploymentUrls = {
  APP_URL: PRODUCTION_URL,
  NEXT_PUBLIC_APP_URL: PRODUCTION_URL,
  NEXT_PUBLIC_SITE_URL: PRODUCTION_URL,
};

const urlKeys = new Set(Object.keys(remoteDeploymentUrls));

const sensitive = new Set([
  "SUPABASE_SERVICE_ROLE_KEY",
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "POKPAY_KEY_ID",
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
    if ((target === "production" || target === "preview") && urlKeys.has(name) && isLocalhostUrl(value)) {
      continue;
    }
    const { ok, out } = addEnv(name, value, target);
    console.log(`${ok ? "✓" : "✗"} ${name} (${target})`);
    if (!ok) console.log(`  ${out.slice(-300)}`);
    ok ? okCount++ : failCount++;
  }
  if (target === "production" || target === "preview") {
    for (const [name, value] of Object.entries(remoteDeploymentUrls)) {
      const { ok, out } = addEnv(name, value, target);
      console.log(`${ok ? "✓" : "✗"} ${name} (${target})`);
      if (!ok) console.log(`  ${out.slice(-300)}`);
      ok ? okCount++ : failCount++;
    }
  }
}

console.log(`\nFinished: ${okCount} ok, ${failCount} failed`);
process.exit(failCount > 0 ? 1 : 0);
