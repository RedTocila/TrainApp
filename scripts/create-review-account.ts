/**
 * Creates (or refreshes) the App Store review demo account:
 * confirmed email, completed questionnaire, macro targets, starter workout
 * program, and an active Elite subscription.
 *
 * Usage: npx tsx scripts/create-review-account.ts <email> <password>
 */

import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

const envPath = resolve(process.cwd(), ".env.local");
if (!existsSync(envPath)) {
  console.error("Missing .env.local");
  process.exit(1);
}
for (const line of readFileSync(envPath, "utf8").split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eq = trimmed.indexOf("=");
  if (eq === -1) continue;
  const key = trimmed.slice(0, eq).trim();
  let value = trimmed.slice(eq + 1).trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  if (!process.env[key]) process.env[key] = value;
}

const email = process.argv[2];
const password = process.argv[3];
if (!email || !password) {
  console.error("Usage: npx tsx scripts/create-review-account.ts <email> <password>");
  process.exit(1);
}

const REVIEW_INTAKE = {
  age: 29,
  gender: "male",
  height_cm: 180,
  intake_weight_kg: 82,
  goal: "build_muscle",
  goal_timeline: "3_6_months",
  training_experience: "intermediate",
  training_days_per_week: "4_5",
  training_time_preference: "evening",
  equipment_access: ["full_gym"],
  current_activities: ["running"],
  job_type: "desk",
  work_hours: "full_time",
  commute: "drive",
  daily_steps: "6k_10k",
  sleep_hours: "7_8",
  wake_time: "07:00",
  bedtime: "23:00",
  energy_level: "moderate",
  diet_type: "omnivore",
  meals_per_day: "4",
  cooking_frequency: "often",
  food_allergies: ["none"],
  injury_areas: ["none"],
  health_conditions: ["none"],
  smoking: "never",
  alcohol: "social",
  stress_level: "moderate",
  water_habits: "sometimes",
};

async function main() {
  const { createAdminClient } = await import("../src/lib/supabase/admin");
  const { applyIntakeToProfile } = await import("../src/lib/actions/client-intake");

  const admin = createAdminClient();

  let userId: string | undefined;
  for (let page = 1; page < 50 && !userId; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    userId = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())?.id;
    if (data.users.length < 200) break;
  }

  if (userId) {
    const { error } = await admin.auth.admin.updateUserById(userId, {
      password,
      email_confirm: true,
      user_metadata: { full_name: "App Review" },
    });
    if (error) throw error;
    console.log("Existing user updated:", userId);
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: "App Review" },
    });
    if (error) throw error;
    userId = data.user.id;
    console.log("User created:", userId);
  }

  const expires = new Date();
  expires.setFullYear(expires.getFullYear() + 1);

  const { data: updated, error: profileError } = await admin
    .from("profiles")
    .update({
      role: "client",
      full_name: "App Review",
      preferred_locale: "en",
      unit_system: "metric",
      subscription_plan: "elite",
      subscription_status: "active",
      subscription_interval: "annual",
      subscription_expires_at: expires.toISOString(),
    })
    .eq("id", userId)
    .select("id");
  if (profileError) throw profileError;
  if (!updated?.length) throw new Error("Profile row missing — signup trigger did not run.");

  const intakeError = await applyIntakeToProfile(userId, admin, REVIEW_INTAKE);
  if (intakeError) throw new Error(intakeError);

  const { data: profile } = await admin
    .from("profiles")
    .select(
      "subscription_plan, subscription_status, subscription_expires_at, target_calories, target_protein, goal"
    )
    .eq("id", userId)
    .single();
  const { count } = await admin
    .from("workout_plans")
    .select("id", { count: "exact", head: true })
    .eq("created_by", userId);

  console.log("Profile:", profile);
  console.log("Workout plans:", count);
  console.log(`Review account ready: ${email}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
