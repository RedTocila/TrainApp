import { Resend } from "resend";
import { getCanonicalSiteOrigin } from "@/lib/app-url";

export const EMAIL_FROM = "RUTINA <noreply@rutina.al>";

const SUPPORT_REPLY =
  process.env.ADMIN_EMAIL?.trim() || "noreply@rutina.al";

function getResend() {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) {
    throw new Error(
      "RESEND_API_KEY is not set. Add it in Vercel (and locally) to send mail from the app."
    );
  }
  return new Resend(key);
}

/** Escape text for safe HTML email bodies. */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Turn plain text (with blank lines) into HTML paragraphs + line breaks. */
export function plainTextToHtml(body: string): string {
  const paragraphs = body
    .trim()
    .split(/\n{2,}/)
    .map((block) => {
      const lines = block
        .split("\n")
        .map((line) => escapeHtml(line.trimEnd()))
        .join("<br />");
      return `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#52525b;">${lines}</p>`;
    });
  return paragraphs.join("");
}

export function wrapRutinaEmailHtml(options: {
  title: string;
  bodyHtml: string;
  ctaLabel?: string;
  ctaUrl?: string;
  footerNote?: string;
}): string {
  const origin = getCanonicalSiteOrigin();
  const cta =
    options.ctaLabel && options.ctaUrl
      ? `
                <table role="presentation" cellspacing="0" cellpadding="0" style="margin:8px 0 24px;">
                  <tr>
                    <td style="border-radius:10px;background:#dc2626;">
                      <a
                        href="${escapeHtml(options.ctaUrl)}"
                        style="display:inline-block;padding:14px 24px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;"
                      >
                        ${escapeHtml(options.ctaLabel)}
                      </a>
                    </td>
                  </tr>
                </table>`
      : "";

  const footer = options.footerNote
    ? `<p style="margin:0;font-size:12px;line-height:1.6;color:#a1a1aa;">${escapeHtml(options.footerNote)}</p>`
    : `<p style="margin:0;font-size:12px;line-height:1.6;color:#a1a1aa;">You're receiving this because you have a RUTINA account.</p>`;

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(options.title)}</title>
  </head>
  <body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#18181b;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f4f5;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:480px;background:#ffffff;border:1px solid #e4e4e7;border-radius:16px;overflow:hidden;">
            <tr>
              <td style="background:#dc2626;padding:24px 28px;text-align:center;">
                <img
                  src="${origin}/email-logo.png"
                  alt="RUTINA"
                  width="48"
                  height="48"
                  style="display:block;margin:0 auto 12px;border-radius:50%;"
                />
                <p style="margin:0;font-size:24px;font-weight:900;letter-spacing:0.08em;color:#ffffff;">RUTINA</p>
                <p style="margin:8px 0 0;font-size:12px;color:rgba(255,255,255,0.85);">Premium Personal Training</p>
              </td>
            </tr>
            <tr>
              <td style="padding:28px;">
                <h1 style="margin:0 0 16px;font-size:22px;font-weight:800;line-height:1.3;color:#18181b;">
                  ${escapeHtml(options.title)}
                </h1>
                ${options.bodyHtml}
                ${cta}
              </td>
            </tr>
            <tr>
              <td style="padding:0 28px 28px;">
                ${footer}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export type SendEmailResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

export async function sendRutinaEmail(options: {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}): Promise<SendEmailResult> {
  const resend = getResend();
  const { data, error } = await resend.emails.send({
    from: EMAIL_FROM,
    to: options.to,
    subject: options.subject,
    html: options.html,
    replyTo: options.replyTo ?? SUPPORT_REPLY,
  });

  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true, id: data?.id ?? "" };
}
