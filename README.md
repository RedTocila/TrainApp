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

## Native apps (Capacitor)

The iOS/Android shells load the live site (`https://rutina.al`). Web stays on Vercel; native projects only wrap it.

```bash
npm install
npx cap sync
npx cap open ios      # requires full Xcode + CocoaPods
npx cap open android  # requires Android Studio + JDK
```

Optional staging URL:

```bash
CAP_SERVER_URL=https://your-preview.vercel.app npx cap sync
```

**App ID:** `al.rutina.app`

### Payments

| Surface | Processor |
|---------|-----------|
| Website | **PokPay** |
| Android Capacitor shell | **PokPay** (for now) |
| iOS Capacitor shell | **Apple In-App Purchase** |

iOS auto-renewable product IDs (create exactly in App Store Connect):

- `al.rutina.app.ai.monthly`
- `al.rutina.app.ai.annual`
- `al.rutina.app.elite.monthly`
- `al.rutina.app.elite.annual`

Set `APPLE_APP_APPLE_ID` in Vercel (numeric App Store Connect Apple ID) so production receipts verify.

Apply migration `supabase/migrations/20260923_apple_iap_orders.sql`.

**Before App Store submit:**
1. Install **Xcode** (Mac App Store)
2. `npx cap sync ios` then `npx cap open ios`
3. Signing & Capabilities → set your **Team**, add **In-App Purchase**
4. Replace `TEAMID` in `public/.well-known/apple-app-site-association` with your Apple Team ID
5. Create the four subscription products + (optional) free-trial introductory offer for AI Pro
6. Set `APPLE_APP_APPLE_ID` in production env
7. Archive → upload → TestFlight → App Review
8. Android / Play: replace SHA-256 in `public/.well-known/assetlinks.json` when you create a signing key
