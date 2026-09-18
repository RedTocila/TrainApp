import { formatUserError } from "@/lib/format-user-error";

function isStaleClientError(error: unknown): boolean {
  return error instanceof Error && error.name === "UnrecognizedActionError";
}

function isBenignNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  if (error.name === "AbortError") return true;
  const message = error.message.toLowerCase();
  return (
    message.includes("failed to fetch") ||
    message.includes("networkerror") ||
    message.includes("load failed") ||
    message.includes("fetch failed")
  );
}

/** Run a server action on the client without letting throws crash the app. */
export async function runServerAction<TResult>(
  action: () => Promise<TResult>,
  fallback = "Something went wrong. Please try again."
): Promise<TResult | { error: string }> {
  try {
    const result = await action();
    if (isActionError(result)) {
      return { error: formatUserError(result.error, fallback) };
    }
    return result;
  } catch (error) {
    if (isStaleClientError(error)) {
      return {
        error: "The app was updated. Reload the page and try again.",
      };
    }
    if (isBenignNetworkError(error)) {
      return { error: "Connection interrupted. Please try again." };
    }
    return { error: formatUserError(error, fallback) };
  }
}

export function isActionError<T>(
  result: T | { error: string }
): result is { error: string } {
  return (
    typeof result === "object" &&
    result !== null &&
    "error" in result &&
    typeof (result as { error?: unknown }).error === "string"
  );
}
