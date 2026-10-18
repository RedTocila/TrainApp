import type { SupabaseClient } from "@supabase/supabase-js";
import { STORAGE_BUCKETS } from "@/lib/supabase/storage";

/**
 * Buckets whose object keys are `{userId}/...` for that account.
 * Meal photos: `{userId}/{logId}.jpg|webp`
 * Progress photos: `{userId}/{month}/{pose}.jpg|webp`
 * Avatars: `{userId}/{filename}` (bucket policy; no current upload call)
 * Blog images and exercise media are shared catalog files and are not included.
 */
export const USER_OWNED_STORAGE_BUCKETS = [
  STORAGE_BUCKETS.mealPhotos,
  STORAGE_BUCKETS.progressPhotos,
  STORAGE_BUCKETS.avatars,
] as const;

export const USER_STORAGE_LIST_PAGE_SIZE = 100;
export const USER_STORAGE_REMOVE_BATCH_SIZE = 100;

export const ACCOUNT_STORAGE_CLEANUP_ERROR =
  "Could not delete your uploaded files, so the account was not deleted. Try again.";

const MAX_ATTEMPTS = 3;
const MAX_PAGES_PER_PREFIX = 200;
const MAX_FOLDER_DEPTH = 8;

const USER_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type StorageObjectEntry = {
  name: string;
  /** Null marks a folder in Supabase Storage. Files have an id. */
  id: string | null;
};

export type UserStorageClient = {
  list(
    bucket: string,
    prefix: string,
    page: { limit: number; offset: number }
  ): Promise<{ entries: StorageObjectEntry[]; error: string | null }>;
  remove(bucket: string, paths: string[]): Promise<{ error: string | null }>;
};

export function isStorageUserId(userId: string): boolean {
  return USER_ID_PATTERN.test(userId) && !userId.includes("/") && !userId.includes("\\");
}

/** True only for object keys strictly inside `{userId}/`, with no `..` segments. */
export function isExactUserStoragePath(userId: string, objectPath: string): boolean {
  if (!isStorageUserId(userId)) return false;
  if (!objectPath.startsWith(`${userId}/`)) return false;
  if (objectPath.includes("\\") || objectPath.includes("\0")) return false;
  const rest = objectPath.slice(userId.length + 1);
  if (!rest) return false;
  return rest.split("/").every((segment) => segment.length > 0 && segment !== "." && segment !== "..");
}

export function joinStoragePath(parent: string, name: string): string | null {
  if (!name || name === "." || name === ".." || name.includes("/") || name.includes("\\")) {
    return null;
  }
  return `${parent}/${name}`;
}

export function isStorageFolderEntry(entry: StorageObjectEntry): boolean {
  return entry.id == null;
}

function chunk<T>(items: T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    batches.push(items.slice(index, index + size));
  }
  return batches;
}

async function withAttempts<T>(
  work: () => Promise<{ error: string | null; value: T }>,
  attempts: number,
  sleep: (ms: number) => Promise<void>
): Promise<{ error: string | null; value: T }> {
  let lastError = ACCOUNT_STORAGE_CLEANUP_ERROR;
  let value = undefined as T;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const result = await work();
      value = result.value;
      if (!result.error) return result;
      lastError = result.error;
    } catch (error) {
      lastError = error instanceof Error ? error.message : ACCOUNT_STORAGE_CLEANUP_ERROR;
    }
    if (attempt < attempts) await sleep(200 * attempt);
  }
  return { error: lastError, value };
}

async function collectPrefixFiles(
  client: UserStorageClient,
  bucket: string,
  userId: string,
  prefix: string,
  depth: number,
  attempts: number,
  sleep: (ms: number) => Promise<void>
): Promise<{ paths: string[]; error: string | null }> {
  if (depth > MAX_FOLDER_DEPTH) {
    return { paths: [], error: "storage folder is too deep" };
  }
  if (prefix !== userId && !isExactUserStoragePath(userId, prefix)) {
    return { paths: [], error: "storage prefix escaped the account" };
  }

  const paths: string[] = [];
  let offset = 0;
  let previousFirstName: string | null = null;
  let mayHaveMore = false;

  for (let page = 0; page < MAX_PAGES_PER_PREFIX; page += 1) {
    const listed = await withAttempts(
      async () => {
        const result = await client.list(bucket, prefix, {
          limit: USER_STORAGE_LIST_PAGE_SIZE,
          offset,
        });
        return { error: result.error, value: result.entries };
      },
      attempts,
      sleep
    );
    if (listed.error) return { paths: [], error: listed.error };

    const entries = listed.value ?? [];
    if (entries.length === 0) break;

    const firstName = entries[0]?.name ?? null;
    if (offset > 0 && firstName && firstName === previousFirstName) {
      return { paths: [], error: "storage listing did not advance" };
    }
    previousFirstName = firstName;

    for (const entry of entries) {
      if (!entry.name || entry.name === "." || entry.name === "..") continue;
      const child = joinStoragePath(prefix, entry.name);
      if (!child || !isExactUserStoragePath(userId, child)) {
        return { paths: [], error: "storage listing returned a path outside the account" };
      }
      if (isStorageFolderEntry(entry)) {
        const nested = await collectPrefixFiles(
          client,
          bucket,
          userId,
          child,
          depth + 1,
          attempts,
          sleep
        );
        if (nested.error) return nested;
        paths.push(...nested.paths);
      } else {
        paths.push(child);
      }
    }

    if (entries.length < USER_STORAGE_LIST_PAGE_SIZE) {
      mayHaveMore = false;
      break;
    }
    offset += entries.length;
    mayHaveMore = true;
  }

  if (mayHaveMore) {
    return { paths: [], error: "storage listing was incomplete" };
  }

  return { paths, error: null };
}

/**
 * Deletes objects under the account id in meal, progress, and avatar buckets.
 * Listing and removal are retried. A failure returns before any auth deletion
 * so the same call can be repeated.
 */
export async function deleteUserOwnedStorage(
  client: UserStorageClient,
  userId: string,
  options?: {
    sleep?: (ms: number) => Promise<void>;
    maxAttempts?: number;
  }
): Promise<{ deleted: number } | { error: string }> {
  if (!isStorageUserId(userId)) {
    return { error: ACCOUNT_STORAGE_CLEANUP_ERROR };
  }

  const sleep = options?.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  const attempts = options?.maxAttempts ?? MAX_ATTEMPTS;
  let deleted = 0;

  try {
    for (const bucket of USER_OWNED_STORAGE_BUCKETS) {
      const listed = await collectPrefixFiles(client, bucket, userId, userId, 0, attempts, sleep);
      if (listed.error) return { error: ACCOUNT_STORAGE_CLEANUP_ERROR };

      const paths = [...new Set(listed.paths)].filter((path) => isExactUserStoragePath(userId, path));
      if (paths.length !== new Set(listed.paths).size) {
        return { error: ACCOUNT_STORAGE_CLEANUP_ERROR };
      }

      for (const batch of chunk(paths.sort(), USER_STORAGE_REMOVE_BATCH_SIZE)) {
        const removed = await withAttempts(
          async () => {
            const result = await client.remove(bucket, batch);
            return { error: result.error, value: null };
          },
          attempts,
          sleep
        );
        if (removed.error) return { error: ACCOUNT_STORAGE_CLEANUP_ERROR };
        deleted += batch.length;
      }
    }
  } catch {
    return { error: ACCOUNT_STORAGE_CLEANUP_ERROR };
  }

  return { deleted };
}

export function userStorageClientFromAdmin(admin: SupabaseClient): UserStorageClient {
  return {
    async list(bucket, prefix, page) {
      if (!prefix) return { entries: [], error: "Refusing to list the storage bucket root." };
      const { data, error } = await admin.storage.from(bucket).list(prefix, {
        limit: page.limit,
        offset: page.offset,
        sortBy: { column: "name", order: "asc" },
      });
      return {
        entries: (data ?? []).map((item) => ({
          name: item.name,
          id: item.id ?? null,
        })),
        error: error?.message ?? null,
      };
    },
    async remove(bucket, paths) {
      if (paths.length === 0) return { error: null };
      const { error } = await admin.storage.from(bucket).remove(paths);
      return { error: error?.message ?? null };
    },
  };
}
