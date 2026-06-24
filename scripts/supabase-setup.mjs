/**
 * Full Supabase setup: SQL migration + storage buckets + admin user
 *
 * Usage:
 *   npm run supabase:setup -- YOUR_DATABASE_PASSWORD
 *   npm run supabase:setup            # buckets + admin only (SQL via dashboard)
 */
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import pg from "pg";
import { spawn } from "child_process";

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

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const BUCKETS = [
  { id: "avatars", public: true, fileSizeLimit: 5242880 },
  { id: "blog-images", public: true, fileSizeLimit: 10485760 },
  { id: "exercise-media", public: true, fileSizeLimit: 20971520 },
  { id: "progress-photos", public: false, fileSizeLimit: 2097152 },
];

async function ensureBuckets() {
  console.log("\n📦 Storage buckets...");
  const { data: existing } = await admin.storage.listBuckets();
  const existingIds = new Set(existing?.map((b) => b.id) ?? []);

  for (const bucket of BUCKETS) {
    if (existingIds.has(bucket.id)) {
      console.log(`  ✓ ${bucket.id} (exists)`);
      continue;
    }
    const { error } = await admin.storage.createBucket(bucket.id, {
      public: bucket.public,
      fileSizeLimit: bucket.fileSizeLimit,
    });
    if (error) {
      console.log(`  ⚠ ${bucket.id}: ${error.message} (may need SQL setup for policies)`);
    } else {
      console.log(`  ✓ ${bucket.id} (created)`);
    }
  }
}

async function trySqlMigration(password) {
  const databaseUrl = process.env.DATABASE_URL;
  const sql = readFileSync(resolve(__dirname, "../supabase/complete_setup.sql"), "utf8");

  async function tryConnect(connUrl) {
    const client = new pg.Client({
      connectionString: connUrl,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 10000,
    });
    await client.connect();
    return client;
  }

  let client;
  if (databaseUrl) {
    client = await tryConnect(databaseUrl);
  } else if (password) {
    const regions = ["eu-central-1", "eu-west-1", "eu-west-2", "us-east-1", "us-west-1", "ap-southeast-1"];
    for (const region of regions) {
      const connUrl = `postgresql://postgres.${ref}:${encodeURIComponent(password)}@aws-0-${region}.pooler.supabase.com:6543/postgres`;
      try {
        console.log(`\n🗄️  Connecting (${region})...`);
        client = await tryConnect(connUrl);
        break;
      } catch {
        /* try next region */
      }
    }
  }

  if (!client) return false;

  try {
    console.log("🗄️  Applying complete_setup.sql...");
    await client.query(sql);
    console.log("  ✓ SQL migration applied");
    return true;
  } finally {
    await client.end();
  }
}

function runCreateAdmin() {
  return new Promise((resolve, reject) => {
    const child = spawn("node", [resolve(__dirname, "create-admin.mjs"), "redtocila@gmail.com", "admin123", "RED Admin"], {
      stdio: "inherit",
      env: process.env,
    });
    child.on("close", (code) => (code === 0 ? resolve(undefined) : reject(new Error("create-admin failed"))));
  });
}

async function verifyTables() {
  const { error } = await admin.from("profiles").select("id").limit(1);
  if (error) {
    console.log("\n⚠️  Tables not found. Run SQL manually:");
    console.log("   https://supabase.com/dashboard/project/hpujlewxfdgkjhavqdyk/sql/new");
    console.log("   Paste: supabase/complete_setup.sql");
    return false;
  }
  console.log("\n✓ Database tables verified");
  return true;
}

async function main() {
  console.log("🚀 TrainApp Supabase Setup");
  console.log(`   Project: ${ref}`);

  const password = process.argv[2] || process.env.SUPABASE_DB_PASSWORD;
  if (password || process.env.DATABASE_URL) {
    try {
      await trySqlMigration(password);
    } catch (err) {
      console.error("  ✗ SQL failed:", err instanceof Error ? err.message : err);
    }
  } else {
    console.log("\n⏭️  Skipping SQL (no database password). Run complete_setup.sql in dashboard.");
  }

  const tablesOk = await verifyTables();

  await ensureBuckets();

  if (tablesOk) {
    console.log("\n👤 Admin user...");
    await runCreateAdmin();
  }

  console.log("\n✅ Setup complete!");
  if (!tablesOk) {
    console.log("\nNext step: open SQL Editor and run supabase/complete_setup.sql, then:");
    console.log("  npm run create-admin -- redtocila@gmail.com admin123 \"RED Admin\"");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
