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
    case "invalid_email":
    case "email_address_invalid":
    case "validation_failed":
      return "Enter a valid email address.";
    case "user_banned":
      return "This account cannot be created. Contact support if you need help.";
    case "email_not_confirmed":
      return "Your account is not verified yet. Try signing in again — it should work within a minute.";
    case "invalid_credentials":
      return "Wrong email or password. If you just signed up, wait a minute and try again.";
    default:
      return `Could not continue (${code}). Please try again.`;
  }
}

export function isEmailNotConfirmedError(value: unknown): boolean {
  if (typeof value === "object" && value !== null) {
    const record = value as Record<string, unknown>;
    const code = record.code ?? record.error_code;
    if (code === "email_not_confirmed") return true;
  }
  const text = formatUserError(value, "").toLowerCase();
  return text.includes("email not confirmed") || text.includes("email_not_confirmed");
}

export function isMissingAdminCredentialsError(value: unknown): boolean {
  const message = formatUserError(value, "").toLowerCase();
  return message.includes("missing supabase admin credentials");
}

export function isDirectSignupRejection(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("already registered") ||
    lower.includes("weak password") ||
    lower.includes("too weak") ||
    lower.includes("invalid health profile") ||
    lower.includes("temporarily disabled") ||
    lower.includes("valid email")
  );
}

export function isEmailDeliverySignupError(value: unknown): boolean {
  const text = formatUserError(value, "").toLowerCase();
  if (
    text.includes("confirmation email") ||
    text.includes("error sending") ||
    text.includes("email rate limit")
  ) {
    return true;
  }

  if (typeof value === "object" && value !== null) {
    const record = value as Record<string, unknown>;
    const status = record.status;
    const name = record.name;
    if (status === 500 || name === "AuthRetryableFetchError") {
      return true;
    }
    if (text === "{}" || text === "") {
      return true;
    }
  }

  return false;
}
