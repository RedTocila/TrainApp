export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface DecodedCursor {
  sortValue: string;
  id: string;
}

export function encodeCursor(sortValue: string, id: string): string {
  return Buffer.from(JSON.stringify({ sortValue, id })).toString("base64url");
}

export function decodeCursor(cursor: string | null | undefined): DecodedCursor | null {
  if (!cursor) return null;
  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as {
      sortValue?: string;
      id?: string;
    };
    if (!parsed.sortValue || !parsed.id) return null;
    return { sortValue: parsed.sortValue, id: parsed.id };
  } catch {
    return null;
  }
}

export function buildCursorPage<T extends { id: string }>(
  items: T[],
  limit: number,
  getSortValue: (item: T) => string
): CursorPage<T> {
  const hasMore = items.length > limit;
  const pageItems = hasMore ? items.slice(0, limit) : items;
  const last = pageItems[pageItems.length - 1];
  return {
    items: pageItems,
    hasMore,
    nextCursor: hasMore && last ? encodeCursor(getSortValue(last), last.id) : null,
  };
}
