# App Review notes — RUTINA (al.rutina.app)

Add a working demo account in App Store Connect before submission. Do not commit the password to this repository. `scripts/create-review-account.ts` can create that account locally; put the email and password only in App Store Connect.

This build is the free native app. Packages, checkout, referrals, and challenge screens are hidden. Do not use screenshots or the description to show challenges, prizes, entry fees, or subscriptions. The website still sells plans; that purchase flow is not part of this iOS build.

The app UI is the site at https://rutina.al inside the iOS shell. Reviewers can still use these native features on a physical iPhone (Health and Live Activities) and a paired Apple Watch:

1. Sign in with the demo account. New accounts can also be created in the app without a purchase.
2. Allow Health access when asked. On the dashboard, the steps card reads today's step count from Apple Health. The app does not write Health data, and it does not upload that step count.
3. Open Workout and start today's workout. After it starts, lock the iPhone. The workout Live Activity shows the current set and can log or adjust it from the Lock Screen. iOS 17 or later is required for the Live Activity.
4. Install the RUTINA Watch app on a paired Apple Watch. It shows today's steps, active energy, and walking and running distance from Apple Health, and it can follow the workout. The watch does not read heart rate and does not write Health data.
5. Profile includes Delete account. Confirming it removes the login and that account's uploaded meal photos, progress photos, and avatar files. This build does not sell App Store subscriptions, so the screen does not offer Apple subscription management.

If a later build turns purchases back on (`NATIVE_APP_FREE`), account deletion must say that Apple may keep billing and must open Apple's subscription management screen before the user confirms. The app cannot cancel Apple billing itself.

If a later build shows challenges again (`NATIVE_HIDE_CHALLENGES`), review the official challenge rules, any prizes, and Apple's sponsorship disclaimer before that submission. Keep screenshots and the description aligned with whichever of those flags ships.
