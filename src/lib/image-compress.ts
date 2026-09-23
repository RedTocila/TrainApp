export type CompressImageOptions = {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
};

const IMAGE_EXT_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
  gif: "image/gif",
};

/** Gallery picks often arrive with an empty MIME type — accept by extension too. */
export function isLikelyImageFile(file: File): boolean {
  if (file.type.startsWith("image/")) return true;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (ext in IMAGE_EXT_MIME) return true;
  // iOS Photos sometimes yields opaque names with an empty type.
  if (!file.type && file.size > 0) return true;
  return false;
}

function withInferredImageType(file: File): File {
  if (file.type.startsWith("image/")) return file;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const mime = IMAGE_EXT_MIME[ext] ?? "image/jpeg";
  return new File([file], file.name || `photo.${ext || "jpg"}`, { type: mime });
}

type DecodedImage = {
  width: number;
  height: number;
  draw: (ctx: CanvasRenderingContext2D, width: number, height: number) => void;
  close: () => void;
};

async function decodeImageFile(file: File): Promise<DecodedImage> {
  try {
    const bitmap = await createImageBitmap(file);
    return {
      width: bitmap.width,
      height: bitmap.height,
      draw: (ctx, width, height) => ctx.drawImage(bitmap, 0, 0, width, height),
      close: () => bitmap.close(),
    };
  } catch {
    // Fallback when createImageBitmap rejects (empty MIME / some HEIC paths).
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error("Could not decode image"));
        el.src = url;
      });
      if (!img.naturalWidth || !img.naturalHeight) {
        throw new Error("Could not decode image");
      }
      return {
        width: img.naturalWidth,
        height: img.naturalHeight,
        draw: (ctx, width, height) => ctx.drawImage(img, 0, 0, width, height),
        close: () => URL.revokeObjectURL(url),
      };
    } catch (error) {
      URL.revokeObjectURL(url);
      throw error;
    }
  }
}

/**
 * Resize and compress a photo in the browser before upload (WebP, ~70% quality).
 */
export async function compressImageFile(
  file: File,
  options: CompressImageOptions = {}
): Promise<File> {
  const maxWidth = options.maxWidth ?? 1280;
  const maxHeight = options.maxHeight ?? 1600;
  const quality = options.quality ?? 0.72;

  if (!isLikelyImageFile(file)) {
    throw new Error("Please choose an image file");
  }

  const source = withInferredImageType(file);
  const decoded = await decodeImageFile(source);
  const scale = Math.min(1, maxWidth / decoded.width, maxHeight / decoded.height);
  const width = Math.max(1, Math.round(decoded.width * scale));
  const height = Math.max(1, Math.round(decoded.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    decoded.close();
    throw new Error("Could not process image");
  }

  decoded.draw(ctx, width, height);
  decoded.close();

  const mimeType = supportsWebp() ? "image/webp" : "image/jpeg";
  const extension = mimeType === "image/webp" ? "webp" : "jpg";

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => (result ? resolve(result) : reject(new Error("Compression failed"))),
      mimeType,
      quality
    );
  });

  const baseName = file.name.replace(/\.[^.]+$/, "") || "progress";
  return new File([blob], `${baseName}.${extension}`, { type: mimeType });
}

/** Parse a data URL into mime type and raw base64 payload. */
export function parseDataUrl(
  dataUrl: string
): { mimeType: string; base64: string } | null {
  const match = dataUrl.match(/^data:(image\/[^;]+);base64,(.+)$/);
  if (!match) return null;
  return { mimeType: match[1], base64: match[2] };
}

/** Read a file as a data URL (for previews and server uploads). */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Could not read image"));
    reader.readAsDataURL(file);
  });
}

function supportsWebp(): boolean {
  if (typeof document === "undefined") return true;
  const canvas = document.createElement("canvas");
  return canvas.toDataURL("image/webp").startsWith("data:image/webp");
}
