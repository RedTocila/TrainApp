/** Prefer the photo library — never set `capture` (that forces the camera). */
export const GALLERY_IMAGE_ACCEPT =
  "image/jpeg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.heic,.heif";

type ShowOpenFilePickerWindow = Window & {
  showOpenFilePicker?: (options?: {
    multiple?: boolean;
    types?: Array<{
      description?: string;
      accept: Record<string, string[]>;
    }>;
  }) => Promise<Array<{ getFile: () => Promise<File> }>>;
};

/**
 * Opens the device photo library / file picker for a single image.
 * Uses the File System Access picker when available (no Take Photo sheet).
 * Falls back to a gallery-oriented `<input type="file">` with no `capture`
 * attribute so browsers prefer the library over the camera chooser.
 */
export async function pickGalleryImage(): Promise<File | null> {
  if (typeof window === "undefined") return null;

  const w = window as ShowOpenFilePickerWindow;
  if (typeof w.showOpenFilePicker === "function") {
    try {
      const [handle] = await w.showOpenFilePicker({
        multiple: false,
        types: [
          {
            description: "Images",
            accept: {
              "image/*": [
                ".jpg",
                ".jpeg",
                ".png",
                ".webp",
                ".heic",
                ".heif",
              ],
            },
          },
        ],
      });
      return (await handle.getFile()) ?? null;
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return null;
      // Fall through to input on unsupported / denied cases
    }
  }

  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = GALLERY_IMAGE_ACCEPT;
    input.multiple = false;
    // Critical: do not set `capture` — that opens the camera / chooser sheet.
    input.setAttribute("autocomplete", "off");
    input.style.cssText =
      "position:fixed;left:0;top:0;width:1px;height:1px;opacity:0;pointer-events:none;";

    const cleanup = () => {
      input.removeEventListener("change", onChange);
      input.removeEventListener("cancel", onCancel);
      input.remove();
    };

    const onChange = () => {
      const file = input.files?.[0] ?? null;
      cleanup();
      resolve(file);
    };

    const onCancel = () => {
      cleanup();
      resolve(null);
    };

    input.addEventListener("change", onChange);
    // Chromium supports cancel; Safari ignores it harmlessly.
    input.addEventListener("cancel", onCancel);
    document.body.appendChild(input);
    input.click();
  });
}
