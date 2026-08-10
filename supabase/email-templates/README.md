# RUTINA auth email templates

Paste these into **Supabase Dashboard → Authentication → Emails** after connecting Resend SMTP.

## SMTP (Resend)

**Authentication → Emails → SMTP Settings**

| Field | Value |
|-------|--------|
| Enable custom SMTP | On |
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | Your Resend API key |
| Sender email | `noreply@rutina.al` |
| Sender name | `RUTINA` |

## Templates

For each row: open the template in Supabase, paste the **subject** from the `.txt` file and **body** from the `.html` file, then save.

| Supabase template | Subject file | Body file |
|-------------------|--------------|-----------|
| Confirm signup | [`confirm-signup-subject.txt`](./confirm-signup-subject.txt) | [`confirm-signup.html`](./confirm-signup.html) |
| Reset password | [`reset-password-subject.txt`](./reset-password-subject.txt) | [`reset-password.html`](./reset-password.html) |
| Magic link | [`magic-link-subject.txt`](./magic-link-subject.txt) | [`magic-link.html`](./magic-link.html) |
| Change email address | [`change-email-subject.txt`](./change-email-subject.txt) | [`change-email.html`](./change-email.html) |
| Invite user | [`invite-user-subject.txt`](./invite-user-subject.txt) | [`invite-user.html`](./invite-user.html) |

All templates use the same RUTINA branding (red header, logo, white card, primary CTA button).

**Confirm signup** links straight to `https://rutina.al/login` (account is unlocked at signup — Supabase OTP links would already be invalid).
**Reset / magic link / invite / change email** use `token_hash` → `/auth/callback` so links work across devices (no PKCE cookie required).

Logo image: [`public/email-logo.png`](../../public/email-logo.png) — served at `https://rutina.al/email-logo.png` (deploy required for emails to show the image).

After changing templates in this folder, paste them again into the Supabase Dashboard — the app does not sync them automatically.

## Test

| Flow | How to trigger |
|------|----------------|
| Confirm signup | Register on https://rutina.al |
| Reset password | Use “Forgot password” on login → email link → `/reset-password` |
| Magic link | Only if magic-link sign-in is enabled in Supabase |
| Change email | Update email in profile settings |
| Invite user | Invite a user from Supabase Dashboard |

Emails should come from **RUTINA &lt;noreply@rutina.al&gt;**.
