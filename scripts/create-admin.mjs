/**
 * Creates an admin user in Supabase.
 * Usage: node scripts/create-admin.mjs
 *
 * Requires in .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   ADMIN_EMAIL (optional, defaults to redtocila@gmail.com)
 *
 * Args: email password [fullName]
 * Example: node scripts/create-admin.mjs redtocila@gmail.com admin123 "RED Admin"
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "../.env.local");

function loadEnv() {
  if (!existsSync(envPath)) {
    console.error("Missing .env.local — add Supabase credentials first.");
    process.exit(1);
  }
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

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey || url.includes("placeholder") || serviceKey.includes("placeholder")) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const email = process.argv[2] || process.env.ADMIN_EMAIL || "redtocila@gmail.com";
const password = process.argv[3] || "admin123";
const fullName = process.argv[4] || "RED Admin";

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  console.log(`Creating admin: ${email}`);

  const { data: existing } = await supabase.auth.admin.listUsers();
  const found = existing?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());

  let userId = found?.id;

  if (found) {
    console.log("User already exists — updating password and admin role...");
    const { error: updateError } = await supabase.auth.admin.updateUserById(found.id, {
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });
    if (updateError) {
      console.error("Failed to update user:", updateError.message);
      process.exit(1);
    }
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });
    if (error) {
      console.error("Failed to create user:", error.message);
      process.exit(1);
    }
    userId = data.user.id;
    console.log("User created:", userId);
  }

  const { error: profileError } = await supabase.from("profiles").upsert(
    {
      id: userId,
      role: "admin",
      full_name: fullName,
    },
    { onConflict: "id" }
  );

  if (profileError) {
    console.error("Failed to set admin profile:", profileError.message);
    console.error("Ensure you ran supabase/migrations/001_initial_schema.sql first.");
    process.exit(1);
  }

  console.log("Admin account ready.");
  console.log(`  Email:    ${email}`);
  console.log(`  Password: ${password}`);
  console.log(`  Login:    http://localhost:3000/login`);
}

main();
