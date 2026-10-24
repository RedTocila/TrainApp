# App Review notes — RUTINA (al.rutina.app)

Add a working demo account in App Store Connect before submission. Do not commit the password to this repository. `scripts/create-review-account.ts` can create that account locally; put the email and password only in App Store Connect.

This build sells Plus and Pro inside the iPhone app with App Store subscriptions. Card checkout stays on https://rutina.al for people who buy on the website. The iPhone app does not send users to the website to pay. A plan bought on the website still works after sign-in. A plan bought with Apple is managed in Settings → Apple ID → Subscriptions.

1. Sign in with the demo account, or create a free account in the app. New accounts do not require a purchase.
2. Allow Health access when asked. On the dashboard, the steps card reads today's step count from Apple Health. The app does not write Health data, and it does not upload that step count.
3. Open Workout and start today's workout. After it starts, lock the iPhone. The workout Live Activity shows the current set and can log or adjust it from the Lock Screen. iOS 17 or later is required for the Live Activity.
4. Install the RUTINA Watch app on a paired Apple Watch. It shows today's steps, active energy, and walking and running distance from Apple Health, and it can follow the workout. The watch does not read heart rate and does not write Health data.
5. Profile includes the plan, Restore purchases, and Manage Apple subscription when the plan was bought with Apple. Delete account tells Apple-billed users that Apple may keep billing and opens Apple subscription settings before they confirm. The app cannot cancel Apple billing itself.

If challenges are hidden again (`NATIVE_HIDE_CHALLENGES`), review the official challenge rules, any prizes, and Apple's sponsorship disclaimer before that submission. Keep screenshots and the description aligned with whichever of those flags ships.
