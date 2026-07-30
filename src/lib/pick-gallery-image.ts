/** Prefer the photo library — never set `capture` (that forces the camera). */
export const GALLERY_IMAGE_ACCEPT =
  "image/jpeg,image/png,image/webp,image/heic,image/heif";

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
              "image/jpeg": [".jpg", ".jpeg"],
              "image/png": [".png"],
              "image/webp": [".webp"],
              "image/heic": [".heic"],
              "image/heif": [".heif"],
            },
          },
        ],
      });
      return (await handle.getFile()) ?? null;
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return null;
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
      "position:fixed;right:0;bottom:0;width:0;height:0;opacity:0;overflow:hidden;";

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
    const onWindowFocus = () => {
      if (settled) return;
      if (focusTimer !== undefined) window.clearTimeout(focusTimer);
      focusTimer = window.setTimeout(() => {
        if (!input.files?.length) finish(null);
      }, 900);
    };

    input.addEventListener("change", onChange);
    input.addEventListener("cancel", onCancel);
    window.addEventListener("focus", onWindowFocus);
    document.body.appendChild(input);
    input.click();
  });
}
