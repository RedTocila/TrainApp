import { formatUserError } from "@/lib/format-user-error";

function isStaleClientError(error: unknown): boolean {
  return error instanceof Error && error.name === "UnrecognizedActionError";
}

/** Run a server action on the client without letting throws crash the app. */
export async function runServerAction<TResult>(
  action: () => Promise<TResult>,
  fallback = "Something went wrong. Please try again."
): Promise<TResult | { error: string }> {
  try {
    return await action();
  } catch (error) {
    if (isStaleClientError(error)) {
      return {
        error: "The app was updated. Reload the page and try again.",
      };
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
