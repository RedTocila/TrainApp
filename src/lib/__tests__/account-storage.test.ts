import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ACCOUNT_STORAGE_CLEANUP_ERROR,
  USER_OWNED_STORAGE_BUCKETS,
  USER_STORAGE_LIST_PAGE_SIZE,
  deleteUserOwnedStorage,
  isExactUserStoragePath,
  isStorageFolderEntry,
  isStorageUserId,
  joinStoragePath,
  type StorageObjectEntry,
  type UserStorageClient,
} from "../account-storage";

const USER_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const USER_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

type Stored = Map<string, Set<string>>;

function memoryClient(initial: Record<string, string[]>): {
  client: UserStorageClient;
  stored: Stored;
  listPrefixes: string[];
  removeCalls: { bucket: string; paths: string[] }[];
  failRemoves: number;
  failLists: number;
} {
  const stored: Stored = new Map(
    Object.entries(initial).map(([bucket, paths]) => [bucket, new Set(paths)])
  );
  const listPrefixes: string[] = [];
  const removeCalls: { bucket: string; paths: string[] }[] = [];
  const state = { failRemoves: 0, failLists: 0 };

  const client: UserStorageClient = {
    async list(bucket, prefix, page) {
      listPrefixes.push(prefix);
      if (state.failLists > 0) {
        state.failLists -= 1;
        return { entries: [], error: "list failed" };
      }
      if (!prefix) return { entries: [], error: "empty prefix" };
      const files = [...(stored.get(bucket) ?? [])];
      const childNames = new Map<string, StorageObjectEntry>();
      const folderPrefix = `${prefix}/`;
      for (const path of files) {
        if (!path.startsWith(folderPrefix)) continue;
        const rest = path.slice(folderPrefix.length);
        const [name, ...nested] = rest.split("/");
        if (!name) continue;
        const existing = childNames.get(name);
        if (nested.length > 0) {
          childNames.set(name, { name, id: null });
        } else if (!existing) {
          childNames.set(name, { name, id: `file-${name}` });
        }
      }
      const entries = [...childNames.values()].sort((a, b) => a.name.localeCompare(b.name));
      return { entries: entries.slice(page.offset, page.offset + page.limit), error: null };
    },
    async remove(bucket, paths) {
      removeCalls.push({ bucket, paths: [...paths] });
      if (state.failRemoves > 0) {
        state.failRemoves -= 1;
        return { error: "remove failed" };
      }
      const files = stored.get(bucket) ?? new Set<string>();
      for (const path of paths) files.delete(path);
      stored.set(bucket, files);
      return { error: null };
    },
  };

  return {
    client,
    stored,
    listPrefixes,
    removeCalls,
    get failRemoves() {
      return state.failRemoves;
    },
    set failRemoves(value: number) {
      state.failRemoves = value;
    },
    get failLists() {
      return state.failLists;
    },
    set failLists(value: number) {
      state.failLists = value;
    },
  };
}

const noSleep = async () => {};

describe("storage path selection", () => {
  it("accepts only a uuid account id", () => {
    assert.equal(isStorageUserId(USER_A), true);
    assert.equal(isStorageUserId(""), false);
    assert.equal(isStorageUserId(`${USER_A}/extra`), false);
    assert.equal(isStorageUserId("not-a-uuid"), false);
    assert.equal(isStorageUserId("../"), false);
  });

  it("keeps object keys inside that account and rejects siblings and traversal", () => {
    assert.equal(isExactUserStoragePath(USER_A, `${USER_A}/log.jpg`), true);
    assert.equal(isExactUserStoragePath(USER_A, `${USER_A}/2026-10/front.webp`), true);
    assert.equal(isExactUserStoragePath(USER_A, USER_A), false);
    assert.equal(isExactUserStoragePath(USER_A, `${USER_B}/log.jpg`), false);
    assert.equal(isExactUserStoragePath(USER_A, `${USER_A}-extra/log.jpg`), false);
    assert.equal(isExactUserStoragePath(USER_A, `${USER_A}/../${USER_B}/log.jpg`), false);
    assert.equal(isExactUserStoragePath("", `${USER_A}/log.jpg`), false);
    assert.equal(joinStoragePath(USER_A, ".."), null);
    assert.equal(joinStoragePath(USER_A, "front.webp"), `${USER_A}/front.webp`);
    assert.equal(isStorageFolderEntry({ name: "2026-10", id: null }), true);
    assert.equal(isStorageFolderEntry({ name: "log.jpg", id: "file-1" }), false);
  });

  it("limits cleanup to meal photos, progress photos, and avatars", () => {
    assert.deepEqual([...USER_OWNED_STORAGE_BUCKETS], [
      "meal-photos",
      "progress-photos",
      "avatars",
    ]);
  });
});

describe("deleteUserOwnedStorage", () => {
  it("removes nested files for one account and paginates", async () => {
    const mealPhotos = Array.from({ length: USER_STORAGE_LIST_PAGE_SIZE + 5 }, (_, index) => {
      return `${USER_A}/meal-${index}.jpg`;
    });
    mealPhotos.push(`${USER_B}/other.jpg`);
    const memory = memoryClient({
      "meal-photos": mealPhotos,
      "progress-photos": [
        `${USER_A}/2026-10/front.webp`,
        `${USER_A}/2026-10/back.webp`,
        `${USER_B}/2026-10/front.webp`,
      ],
      avatars: [`${USER_A}/avatar.png`, `${USER_B}/avatar.png`],
    });

    const result = await deleteUserOwnedStorage(memory.client, USER_A, { sleep: noSleep });
    assert.deepEqual(result, { deleted: USER_STORAGE_LIST_PAGE_SIZE + 5 + 2 + 1 });
    assert.deepEqual([...(memory.stored.get("meal-photos") ?? [])], [`${USER_B}/other.jpg`]);
    assert.deepEqual(
      [...(memory.stored.get("progress-photos") ?? [])],
      [`${USER_B}/2026-10/front.webp`]
    );
    assert.deepEqual([...(memory.stored.get("avatars") ?? [])], [`${USER_B}/avatar.png`]);
    assert.ok(memory.listPrefixes.every((prefix) => prefix === USER_A || prefix.startsWith(`${USER_A}/`)));
    assert.ok(memory.removeCalls.every((call) => call.paths.every((path) => path.startsWith(`${USER_A}/`))));
  });

  it("retries a failed removal and can be run again after a partial delete", async () => {
    const memory = memoryClient({
      "meal-photos": [`${USER_A}/one.jpg`, `${USER_A}/two.jpg`],
      "progress-photos": [],
      avatars: [],
    });
    memory.failRemoves = 2;

    const first = await deleteUserOwnedStorage(memory.client, USER_A, { sleep: noSleep });
    assert.deepEqual(first, { deleted: 2 });
    assert.equal(memory.removeCalls.length, 3);
    assert.equal(memory.stored.get("meal-photos")?.size, 0);

    const second = await deleteUserOwnedStorage(memory.client, USER_A, { sleep: noSleep });
    assert.deepEqual(second, { deleted: 0 });
  });

  it("returns an error and deletes nothing when listing keeps failing", async () => {
    const memory = memoryClient({
      "meal-photos": [`${USER_A}/one.jpg`],
      "progress-photos": [],
      avatars: [],
    });
    memory.failLists = 9;

    const result = await deleteUserOwnedStorage(memory.client, USER_A, { sleep: noSleep });
    assert.deepEqual(result, { error: ACCOUNT_STORAGE_CLEANUP_ERROR });
    assert.equal(memory.removeCalls.length, 0);
    assert.equal(memory.stored.get("meal-photos")?.has(`${USER_A}/one.jpg`), true);
  });

  it("does not list or remove anything for an invalid account id", async () => {
    const memory = memoryClient({
      "meal-photos": [`${USER_A}/one.jpg`],
      "progress-photos": [],
      avatars: [],
    });
    const result = await deleteUserOwnedStorage(memory.client, `${USER_A}/`, { sleep: noSleep });
    assert.deepEqual(result, { error: ACCOUNT_STORAGE_CLEANUP_ERROR });
    assert.equal(memory.listPrefixes.length, 0);
    assert.equal(memory.removeCalls.length, 0);
  });
});
