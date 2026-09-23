/** Prefer the photo library — never set `capture` (that forces the camera). */
export const GALLERY_IMAGE_ACCEPT =
  "image/jpeg,image/png,image/webp,image/heic,image/heif,image/*";

type ShowOpenFilePickerWindow = Window & {
  showOpenFilePicker?: (options?: {
    multiple?: boolean;
    excludeAcceptAllOption?: boolean;
    startIn?:
      | "pictures"
      | "downloads"
      | "desktop"
      | "documents"
      | "music"
      | "videos";
    types?: Array<{
      description?: string;
      accept: Record<string, string[]>;
    }>;
  }) => Promise<Array<{ getFile: () => Promise<File> }>>;
};

function isAppleTouchDevice() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return (
    /iP(hone|od|ad)/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

/**
 * Opens the device photo library / file picker for a single image.
 *
 * IMPORTANT: Call this directly from a click/tap handler with no `await`
 * beforehand — browsers revoke the user-gesture after the first await, and
 * then `input.click()` / `showOpenFilePicker` silently fail.
 *
 * Chromium: File System Access picker in Pictures (no Take Photo sheet).
 * iOS Safari: Apple always shows Photo Library / Take Photo / Choose File for
 * image accepts — no web API skips that menu. Never set `capture`.
 */
export async function pickGalleryImage(): Promise<File | null> {
  if (typeof window === "undefined") return null;

  const w = window as ShowOpenFilePickerWindow;
  if (!isAppleTouchDevice() && typeof w.showOpenFilePicker === "function") {
    try {
      const [handle] = await w.showOpenFilePicker({
        multiple: false,
        excludeAcceptAllOption: true,
        startIn: "pictures",
        types: [
          {
            description: "Images",
            accept: {
              "image/*": [".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"],
            },
          },
        ],
      });
      return (await handle.getFile()) ?? null;
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return null;
      // Fall through to <input type="file"> if the FS picker is blocked.
    }
  }

  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = GALLERY_IMAGE_ACCEPT;
    input.multiple = false;
    input.removeAttribute("capture");
    input.setAttribute("autocomplete", "off");
    // Attached + in-document — detached inputs get GC'd on iOS mid-picker.
    input.style.cssText =
      "position:fixed;left:0;top:0;width:1px;height:1px;opacity:0.01;overflow:hidden;z-index:2147483647;";

    let settled = false;
    let focusTimer: number | undefined;

    const cleanup = () => {
      if (focusTimer !== undefined) window.clearTimeout(focusTimer);
      input.removeEventListener("change", onChange);
      input.removeEventListener("cancel", onCancel);
      window.removeEventListener("focus", onWindowFocus);
      input.remove();
    };

    const finish = (file: File | null) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(file);
    };

    const onChange = () => {
      finish(input.files?.[0] ?? null);
    };

    const onCancel = () => {
      finish(null);
    };

    // Safari often skips the cancel event when dismissing the sheet.
    // After focus returns, poll for the file — iCloud “Optimize Storage”
    // photos can take several seconds to download before `change` fires.
    // A short single timeout used to resolve null and drop the pick.
    const onWindowFocus = () => {
      if (settled) return;
      if (focusTimer !== undefined) window.clearTimeout(focusTimer);

      const startedAt = Date.now();
      const maxWaitMs = 20_000;
      const intervalMs = 250;

      const poll = () => {
        if (settled) return;
        if (input.files?.length) {
          finish(input.files[0] ?? null);
          return;
        }
        if (Date.now() - startedAt >= maxWaitMs) {
          finish(null);
          return;
        }
        focusTimer = window.setTimeout(poll, intervalMs);
      };

      // Brief delay so a synchronous change event can win first.
      focusTimer = window.setTimeout(poll, 400);
    };

    input.addEventListener("change", onChange);
    input.addEventListener("cancel", onCancel);
    window.addEventListener("focus", onWindowFocus);
    document.body.appendChild(input);
    // Must stay synchronous with the originating click gesture.
    input.click();
  });
}
