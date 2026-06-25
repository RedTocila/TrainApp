/**
 * Add profiles.unit_system column (required for profile settings save).
 *
 * Usage:
 *   node scripts/apply-profile-unit-system.mjs YOUR_DATABASE_PASSWORD
 *   # or set SUPABASE_DB_PASSWORD / DATABASE_URL in .env.local
 */
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "../.env.local");
const ref = "hpujlewxfdgkjhavqdyk";

function loadEnv() {
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnv();

const password = process.argv[2] || process.env.SUPABASE_DB_PASSWORD;
const databaseUrl = process.env.DATABASE_URL;
const sql = readFileSync(
  resolve(__dirname, "../supabase/migrations/20240724_profile_unit_system.sql"),
  "utf8"
);

async function tryConnect(url) {
  const client = new pg.Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });
  await client.connect();
  return client;
}

async function main() {
  let client;

  if (databaseUrl) {
    client = await tryConnect(databaseUrl);
  } else if (password) {
    const regions = ["eu-central-1", "eu-west-1", "eu-west-2", "us-east-1", "us-west-1", "ap-southeast-1"];
    let lastError;
    for (const region of regions) {
      const url = `postgresql://postgres.${ref}:${encodeURIComponent(password)}@aws-0-${region}.pooler.supabase.com:6543/postgres`;
      try {
        console.log(`Trying pooler region ${region}...`);
        client = await tryConnect(url);
        console.log(`Connected via ${region}`);
        break;
      } catch (err) {
        lastError = err;
      }
    }
    if (!client) throw lastError;
  } else {
    console.error("Provide database password: node scripts/apply-profile-unit-system.mjs YOUR_DB_PASSWORD");
    console.error("Or set DATABASE_URL / SUPABASE_DB_PASSWORD in .env.local");
    process.exit(1);
  }

  try {
    console.log("Applying profiles.unit_system migration...");
    await client.query(sql);
    console.log("Done — profile unit_system column is ready.");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("Migration failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
