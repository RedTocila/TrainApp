# RUTINA — Premium Personal Training Platform

A Trainerize-style coaching platform for personal trainers. Clients get dashboards with workouts, nutrition, water/macros tracking, calendar, and blog. Coaches (admin) build plans and get notified when clients apply.

## Tech Stack

- **Next.js 16** (App Router, TypeScript)
- **Tailwind CSS v4** + custom red/black premium theme
- **Framer Motion** for animations
- **Supabase** for auth, database, and realtime notifications

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Run the migration in `supabase/migrations/001_initial_schema.sql` via the SQL Editor
3. Copy `.env.example` to `.env.local` and fill in your keys

### 3. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 4. First login

Register with the email set in `ADMIN_EMAIL` — you'll be assigned the admin role and redirected to `/admin`.

## Deploy

Deploy to Vercel and add the same environment variables from `.env.local`.
