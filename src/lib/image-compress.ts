export type CompressImageOptions = {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
};

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

  if (!file.type.startsWith("image/")) {
    throw new Error("Please choose an image file");
  }

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxWidth / bitmap.width, maxHeight / bitmap.height);
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new Error("Could not process image");
  }

  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

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
