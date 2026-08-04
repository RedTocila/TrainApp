/** Turn API / server-action errors into safe user-facing strings (never raw JSON dumps). */
export function formatUserError(
  value: unknown,
  fallback = "Something went wrong. Please try again."
): string {
  if (value == null) return fallback;

  if (typeof value === "string") {
    return sanitizeErrorText(value, fallback);
  }

  if (value instanceof Error) {
    return sanitizeErrorText(value.message, fallback);
  }

  if (typeof value === "object") {
    const fromStructured = messageFromApiObject(value as Record<string, unknown>);
    if (fromStructured) return sanitizeErrorText(fromStructured, fallback);

    const record = value as Record<string, unknown>;
    const code = record.code ?? record.error_code ?? record.type;
    if (typeof code === "string" && code.trim()) {
      return humanizeErrorCode(code.trim());
    }
  }

  return fallback;
}

function sanitizeErrorText(raw: string, fallback: string): string {
  const trimmed = raw.trim();
  if (!trimmed || trimmed === "{}") return fallback;

  // Anthropic / OpenAI often surface as: `404 {"type":"error",...}`
  const jsonPayload = extractJsonObject(trimmed);
  if (jsonPayload) {
    const fromJson = messageFromApiObject(jsonPayload);
    if (fromJson) return humanizeAiMessage(fromJson);
  }

  if (looksLikeRawApiDump(trimmed)) {
    return humanizeAiMessage(trimmed);
  }

  return humanizeAiMessage(trimmed);
}

function extractJsonObject(text: string): Record<string, unknown> | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(text.slice(start, end + 1)) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return null;
  }
  return null;
}

function messageFromApiObject(record: Record<string, unknown>): string | null {
  const nestedError = record.error;
  if (nestedError && typeof nestedError === "object" && !Array.isArray(nestedError)) {
    const nested = nestedError as Record<string, unknown>;
    if (typeof nested.message === "string" && nested.message.trim()) {
      return nested.message.trim();
    }
    if (typeof nested.type === "string" && nested.type.trim()) {
      return nested.type.trim();
    }
  }

  for (const key of ["message", "msg", "error_description"] as const) {
    const candidate = record[key];
    if (typeof candidate === "string") {
      const trimmed = candidate.trim();
      if (trimmed && trimmed !== "{}") return trimmed;
    }
  }

  if (typeof nestedError === "string") {
    const trimmed = nestedError.trim();
    if (trimmed && trimmed !== "{}") return trimmed;
  }

  return null;
}

function looksLikeRawApiDump(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    (lower.includes('"type":"error"') || lower.includes('"error":')) &&
    (lower.includes("request_id") || lower.includes("not_found") || /^\d{3}\s*\{/.test(text))
  );
}

function humanizeAiMessage(message: string): string {
  const lower = message.toLowerCase();

  if (
    lower.includes("not_found_error") ||
    lower.includes("model:") ||
    (lower.includes("model") && lower.includes("not_found"))
  ) {
    return "AI is temporarily unavailable (model configuration). Please try again later.";
  }

  if (
    lower.includes("invalid_api_key") ||
    lower.includes("authentication") ||
    lower.includes("unauthorized") ||
    lower.includes("401")
  ) {
    return "AI is not configured correctly. Please try again later.";
  }

  if (
    lower.includes("rate_limit") ||
    lower.includes("too many requests") ||
    lower.includes("429")
  ) {
    return "AI is busy right now. Please wait a moment and try again.";
  }

  if (
    lower.includes("insufficient_quota") ||
    lower.includes("billing") ||
    lower.includes("credit")
  ) {
    return "AI usage limit reached. Please try again later.";
  }

  if (lower.includes("timeout") || lower.includes("timed out") || lower.includes("econnreset")) {
    return "The AI request timed out. Please try again.";
  }

  if (lower.includes("network") || lower.includes("fetch failed") || lower.includes("enotfound")) {
    return "Could not reach AI right now. Check your connection and try again.";
  }

  // Never show JSON / status-code dumps to users.
  if (looksLikeRawApiDump(message) || /^\d{3}\b/.test(message.trim()) || message.trim().startsWith("{")) {
    return "Something went wrong with AI. Please try again.";
  }

  // Keep short, readable app messages; truncate runaway provider text (don't hide it).
  if (message.length > 220) {
    return `${message.slice(0, 217).trimEnd()}…`;
  }

  return message;
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
      return "You can open the app now — verify your email anytime from the link we sent.";
    case "invalid_credentials":
      return "Wrong email or password. If you just signed up, wait a minute and try again.";
    case "not_found_error":
      return "AI is temporarily unavailable. Please try again later.";
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
