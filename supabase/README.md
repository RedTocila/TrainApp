# Supabase Setup — RUTINA

Project: **hpujlewxfdgkjhavqdyk**  
Dashboard: https://supabase.com/dashboard/project/hpujlewxfdgkjhavqdyk

## Quick setup (recommended)

1. Open [SQL Editor](https://supabase.com/dashboard/project/hpujlewxfdgkjhavqdyk/sql/new)
2. Paste and run the entire file: [`complete_setup.sql`](./complete_setup.sql)
3. Run locally:

```bash
npm run supabase:setup
npm run create-admin -- redtocila@gmail.com admin123 "RED Admin"
```

## User workouts migration (existing projects)

If you already ran `complete_setup.sql` before user-created workouts were added, also run:

[`migrations/20240623_user_workouts.sql`](./migrations/20240623_user_workouts.sql)

This adds personal workout plans, YouTube `video_url` on exercises, and `scheduled_workouts` for calendar scheduling.

## What `complete_setup.sql` creates

### Tables (12)
| Table | Purpose |
|-------|---------|
| `profiles` | User roles (admin/client), avatars |
| `plan_requests` | Client workout/diet applications |
| `notifications` | In-app alerts (realtime enabled) |
| `workout_plans` | Coach workout templates |
| `workout_days` | Days within a plan |
| `exercises` | Exercises per day (+ `image_url`) |
| `workout_assignments` | Plan → client mapping |
| `nutrition_plans` | Diet templates + macro targets |
| `meals` | Meals per nutrition plan |
| `nutrition_assignments` | Diet plan → client mapping |
| `daily_logs` | Water + macros per day |
| `blog_posts` | Info blog articles |

### Storage buckets (3)
| Bucket | Public | Max size | Use |
|--------|--------|----------|-----|
| `avatars` | Yes | 5 MB | Profile photos (`{user_id}/file`) |
| `blog-images` | Yes | 10 MB | Blog cover images |
| `exercise-media` | Yes | 20 MB | Exercise images/videos |

### Functions
- `is_admin()` — RLS helper
- `handle_new_user()` — Auto-create profile on signup
- `notify_user()` — Send notification to a user
- `notify_all_admins()` — Alert all coaches on plan requests

### Security
- Row Level Security on all tables
- Storage policies: users upload own avatars, admin manages blog/exercise media
- Realtime on `notifications` table

## Automated setup (with DB password)

```bash
npm run supabase:setup -- YOUR_DATABASE_PASSWORD
```

Find password: **Settings → Database → Database password**

## Environment variables

```env
NEXT_PUBLIC_SUPABASE_URL=https://hpujlewxfdgkjhavqdyk.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
ADMIN_EMAIL=redtocila@gmail.com
```

Optional:
```env
DATABASE_URL=postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
SUPABASE_DB_PASSWORD=your-db-password
```

## Auth settings (Dashboard)

**Authentication → Providers → Email**
- Enable Email provider
- For dev: disable "Confirm email" so login works immediately

**Authentication → URL Configuration**
- Site URL: `http://localhost:3000` (dev) or your Vercel URL
- Redirect URLs: `http://localhost:3000/auth/callback`, `https://your-domain.com/auth/callback`
