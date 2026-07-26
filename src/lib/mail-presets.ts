import { getCanonicalSiteOrigin } from "@/lib/app-url";

export type MailAudience =
  | "not_subscribed"
  | "subscribed"
  | "trialing"
  | "all"
  | "single";

export type MailPresetId =
  | "custom"
  | "not_subscribed_checkin"
  | "product_update"
  | "feedback";

export interface MailPreset {
  id: MailPresetId;
  label: string;
  description: string;
  /** Suggested audience when this preset is picked */
  audience: MailAudience;
  subject: string;
  /** Use {{name}} for the client's first name */
  body: string;
  ctaLabel?: string;
  ctaPath?: string;
}

const originHint = "https://rutina.al";

export const MAIL_PRESETS: MailPreset[] = [
  {
    id: "not_subscribed_checkin",
    label: "Not subscribed — check in",
    description: "Ask what blocked them from subscribing and how you can help.",
    audience: "not_subscribed",
    subject: "Quick check-in from RUTINA",
    body: `Hi {{name}},

I noticed you created a RUTINA account but haven't subscribed yet — no pressure at all.

I just wanted to ask: is something unclear, missing, or getting in the way? Pricing, plans, the app itself — anything.

Reply to this email and tell me what's going on. I'm happy to help fix it or walk you through the next step.

— Coach`,
    ctaLabel: "View plans",
    ctaPath: "/dashboard/pricing",
  },
  {
    id: "product_update",
    label: "Product update",
    description: "Announce what's new in the app.",
    audience: "all",
    subject: "What's new in RUTINA",
    body: `Hi {{name}},

We've shipped a few updates we think you'll like:

• [Update 1 — short description]
• [Update 2 — short description]
• [Update 3 — short description]

Open the app to try them out. If something feels off, just reply to this email.

— Coach`,
    ctaLabel: "Open RUTINA",
    ctaPath: "/dashboard",
  },
  {
    id: "feedback",
    label: "Ask for feedback",
    description: "Invite honest feedback on the experience.",
    audience: "all",
    subject: "Got 30 seconds? We want your feedback",
    body: `Hi {{name}},

We're improving RUTINA based on real feedback from people using it.

What's working for you? What's frustrating? What should we build next?

Just reply to this email — even one sentence helps.

Thank you,
— Coach`,
    ctaLabel: "Open RUTINA",
    ctaPath: "/dashboard",
  },
  {
    id: "custom",
    label: "Custom message",
    description: "Write your own subject and body from scratch.",
    audience: "not_subscribed",
    subject: "",
    body: `Hi {{name}},

`,
  },
];

export const MAIL_AUDIENCE_OPTIONS: {
  id: MailAudience;
  label: string;
  description: string;
}[] = [
  {
    id: "not_subscribed",
    label: "Not subscribed",
    description: "Clients without an active paid plan or trial",
  },
  {
    id: "subscribed",
    label: "Subscribed",
    description: "Clients with active paid access (including trial)",
  },
  {
    id: "trialing",
    label: "On free trial",
    description: "Clients currently on the AI Pro trial",
  },
  {
    id: "all",
    label: "All clients",
    description: "Everyone with an email on file",
  },
  {
    id: "single",
    label: "One client",
    description: "Pick a specific person",
  },
];

export function getMailPreset(id: MailPresetId): MailPreset {
  return MAIL_PRESETS.find((p) => p.id === id) ?? MAIL_PRESETS[MAIL_PRESETS.length - 1]!;
}

export function personalizeMailBody(template: string, fullName: string): string {
  const first = fullName.trim().split(/\s+/)[0] || "there";
  return template.replaceAll("{{name}}", first);
}

export function resolveMailCtaUrl(path?: string): string | undefined {
  if (!path) return undefined;
  const origin = getCanonicalSiteOrigin();
  if (path.startsWith("http")) return path;
  return `${origin}${path.startsWith("/") ? path : `/${path}`}`;
}

/** For UI copy only — real URLs use getCanonicalSiteOrigin at send time. */
export function mailCtaPreviewUrl(path?: string): string | undefined {
  if (!path) return undefined;
  if (path.startsWith("http")) return path;
  return `${originHint}${path.startsWith("/") ? path : `/${path}`}`;
}
