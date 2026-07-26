"use server";

import { requireAdmin } from "@/lib/actions/auth";
import {
  getAdminClientsWithSubscriptions,
  type AdminClientRow,
} from "@/lib/actions/admin-stats";
import {
  plainTextToHtml,
  sendRutinaEmail,
  wrapRutinaEmailHtml,
} from "@/lib/email";
import {
  getMailPreset,
  personalizeMailBody,
  resolveMailCtaUrl,
  type MailAudience,
  type MailPresetId,
} from "@/lib/mail-presets";

export type MailRecipient = {
  id: string;
  fullName: string;
  email: string;
};

const MAX_RECIPIENTS_PER_SEND = 100;

function matchesAudience(
  client: AdminClientRow,
  audience: MailAudience
): boolean {
  switch (audience) {
    case "not_subscribed":
      return !client.activeSubscription;
    case "subscribed":
      return client.activeSubscription;
    case "trialing":
      return client.onFreeTrial;
    case "all":
      return true;
    case "single":
      return false;
    default:
      return false;
  }
}

function resolveAudienceRecipients(
  clients: AdminClientRow[],
  audience: MailAudience,
  clientId?: string | null
): { recipients: MailRecipient[]; missingEmailCount: number } {
  let matched: AdminClientRow[];
  if (audience === "single") {
    const id = clientId?.trim();
    matched = id ? clients.filter((c) => c.id === id) : [];
  } else {
    matched = clients.filter((c) => matchesAudience(c, audience));
  }

  const recipients: MailRecipient[] = [];
  let missingEmailCount = 0;
  for (const client of matched) {
    const email = client.email?.trim();
    if (!email) {
      missingEmailCount += 1;
      continue;
    }
    recipients.push({
      id: client.id,
      fullName: client.full_name,
      email,
    });
  }

  return { recipients, missingEmailCount };
}

export async function getMailAudiencePreview(options: {
  audience: MailAudience;
  clientId?: string | null;
}): Promise<{
  count: number;
  recipients: MailRecipient[];
  missingEmailCount: number;
}> {
  await requireAdmin();
  const clients = await getAdminClientsWithSubscriptions();
  const { recipients, missingEmailCount } = resolveAudienceRecipients(
    clients,
    options.audience,
    options.clientId
  );

  return {
    count: recipients.length,
    recipients: recipients.slice(0, 40),
    missingEmailCount,
  };
}

export async function listMailClientsForPicker(): Promise<
  { id: string; fullName: string; email: string; label: string }[]
> {
  await requireAdmin();
  const clients = await getAdminClientsWithSubscriptions();
  return clients
    .filter((c) => Boolean(c.email?.trim()))
    .map((c) => ({
      id: c.id,
      fullName: c.full_name,
      email: c.email!.trim(),
      label: `${c.full_name} · ${c.email}${
        c.activeSubscription ? "" : " · not subscribed"
      }`,
    }));
}

export type SendAdminMailInput = {
  audience: MailAudience;
  clientId?: string | null;
  presetId: MailPresetId;
  subject: string;
  body: string;
  ctaLabel?: string | null;
  ctaPath?: string | null;
  /** When true, only return who would be emailed — do not send. */
  dryRun?: boolean;
};

export type SendAdminMailResult = {
  ok: boolean;
  dryRun?: boolean;
  attempted: number;
  sent: number;
  failed: number;
  errors: string[];
  message: string;
};

export async function sendAdminMail(
  input: SendAdminMailInput
): Promise<SendAdminMailResult> {
  await requireAdmin();

  const subject = input.subject.trim();
  const body = input.body.trim();
  if (!subject) {
    return {
      ok: false,
      attempted: 0,
      sent: 0,
      failed: 0,
      errors: ["Subject is required."],
      message: "Subject is required.",
    };
  }
  if (!body) {
    return {
      ok: false,
      attempted: 0,
      sent: 0,
      failed: 0,
      errors: ["Message body is required."],
      message: "Message body is required.",
    };
  }

  if (!process.env.RESEND_API_KEY?.trim()) {
    return {
      ok: false,
      attempted: 0,
      sent: 0,
      failed: 0,
      errors: ["RESEND_API_KEY is not configured."],
      message:
        "Add RESEND_API_KEY to your environment (same key as Supabase SMTP) to send mail.",
    };
  }

  const clients = await getAdminClientsWithSubscriptions();
  const { recipients } = resolveAudienceRecipients(
    clients,
    input.audience,
    input.clientId
  );

  if (recipients.length === 0) {
    return {
      ok: false,
      attempted: 0,
      sent: 0,
      failed: 0,
      errors: ["No recipients with an email for this audience."],
      message: "No recipients with an email for this audience.",
    };
  }

  if (recipients.length > MAX_RECIPIENTS_PER_SEND) {
    return {
      ok: false,
      attempted: recipients.length,
      sent: 0,
      failed: 0,
      errors: [
        `Audience has ${recipients.length} recipients. Max per send is ${MAX_RECIPIENTS_PER_SEND} (Resend free daily limit is 100). Narrow the audience or send in batches.`,
      ],
      message: `Too many recipients (${recipients.length}). Max ${MAX_RECIPIENTS_PER_SEND} per send.`,
    };
  }

  if (input.dryRun) {
    return {
      ok: true,
      dryRun: true,
      attempted: recipients.length,
      sent: 0,
      failed: 0,
      errors: [],
      message: `Dry run: would email ${recipients.length} recipient(s).`,
    };
  }

  const preset = getMailPreset(input.presetId);
  const ctaLabel = (input.ctaLabel ?? preset.ctaLabel)?.trim() || undefined;
  const ctaPath = (input.ctaPath ?? preset.ctaPath)?.trim() || undefined;
  const ctaUrl = resolveMailCtaUrl(ctaPath);
  const title = subject;

  let sent = 0;
  const errors: string[] = [];

  for (const recipient of recipients) {
    const personalized = personalizeMailBody(body, recipient.fullName);
    const html = wrapRutinaEmailHtml({
      title,
      bodyHtml: plainTextToHtml(personalized),
      ctaLabel,
      ctaUrl,
    });

    const result = await sendRutinaEmail({
      to: recipient.email,
      subject,
      html,
    });

    if (result.ok) {
      sent += 1;
    } else {
      errors.push(`${recipient.email}: ${result.error}`);
    }

    // Gentle pacing for Resend free-tier / rate limits
    if (recipients.length > 1) {
      await new Promise((r) => setTimeout(r, 120));
    }
  }

  const failed = recipients.length - sent;
  const ok = sent > 0 && failed === 0;
  const partial = sent > 0 && failed > 0;

  return {
    ok: ok || partial,
    attempted: recipients.length,
    sent,
    failed,
    errors: errors.slice(0, 10),
    message: partial
      ? `Sent ${sent}/${recipients.length}. ${failed} failed.`
      : ok
        ? `Sent ${sent} email${sent === 1 ? "" : "s"}.`
        : `Failed to send. ${errors[0] ?? "Unknown error."}`,
  };
}
