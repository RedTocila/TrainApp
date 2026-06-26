/**
 * Apply SQL migration using direct Postgres connection.
 *
 * Usage:
 *   npm run db:migrate -- YOUR_DATABASE_PASSWORD
 *   # or set DATABASE_URL in .env.local
 *
 * Password: Supabase → Project Settings → Database → Database password
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
  const content = readFileSync(envPath, "utf8");
  for (const line of content.split("\n")) {
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

const args = process.argv.slice(2);
const migrationArg = args.find((a) => a.endsWith(".sql"));
const password = args.find((a) => !a.endsWith(".sql")) || process.env.SUPABASE_DB_PASSWORD;
let databaseUrl = process.env.DATABASE_URL;

const migrationFile = migrationArg ?? "complete_setup.sql";
const sqlPath = migrationFile.startsWith("migrations/")
  ? resolve(__dirname, `../supabase/${migrationFile}`)
  : resolve(__dirname, `../supabase/${migrationFile}`);
const sql = readFileSync(sqlPath, "utf8");
console.log(`Migration file: supabase/${migrationFile}`);

async function tryConnect(url) {
  const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 8000 });
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
    console.error("Provide database password: npm run db:migrate -- YOUR_DB_PASSWORD");
    console.error("Or set DATABASE_URL in .env.local");
    process.exit(1);
  }

  try {
    console.log("Applying migration...");
    await client.query(sql);
    console.log("Migration applied successfully.");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("Migration failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
