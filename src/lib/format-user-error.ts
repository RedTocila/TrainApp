/** Turn API / server-action errors into safe user-facing strings (never `{}`). */
export function formatUserError(value: unknown, fallback = "Something went wrong. Please try again."): string {
  if (value == null) return fallback;

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed || trimmed === "{}") return fallback;
    return trimmed;
  }

  if (value instanceof Error) {
    const trimmed = value.message.trim();
    return trimmed && trimmed !== "{}" ? trimmed : fallback;
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;

    for (const key of ["message", "msg", "error_description", "error"] as const) {
      const candidate = record[key];
      if (typeof candidate === "string") {
        const trimmed = candidate.trim();
        if (trimmed && trimmed !== "{}") return trimmed;
      }
    }

    const code = record.code ?? record.error_code;
    if (typeof code === "string" && code.trim()) {
      return humanizeErrorCode(code.trim());
    }
  }

  return fallback;
}

function humanizeErrorCode(code: string): string {
  switch (code) {
    case "unexpected_failure":
      return "Something went wrong on our side. Please try again in a moment.";
    case "email_exists":
    case "user_already_exists":
      return "This email is already registered. Sign in instead.";
    case "weak_password":
      return "Password is too weak. Use at least 6 characters.";
    case "over_email_send_rate_limit":
      return "Too many emails sent. Please wait a few minutes and try again.";
    case "signup_disabled":
      return "New signups are temporarily disabled.";
    default:
      return `Could not continue (${code}). Please try again.`;
  }
}

export function isEmailDeliverySignupError(value: unknown): boolean {
  const text = formatUserError(value, "").toLowerCase();
  return text.includes("confirmation email") || text.includes("error sending");
}
