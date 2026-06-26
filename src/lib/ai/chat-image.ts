import type { ChatImageAttachment } from "@/lib/ai/types";

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export function validateChatImage(
  image: ChatImageAttachment | null | undefined
): { image: ChatImageAttachment } | { error: string } {
  if (!image?.base64?.trim()) {
    return { error: "No image provided." };
  }
  if (!ALLOWED_MIME_TYPES.has(image.mimeType)) {
    return { error: "Unsupported image type. Use JPEG, PNG, or WebP." };
  }

  const sizeBytes = Math.ceil((image.base64.length * 3) / 4);
  if (sizeBytes > MAX_IMAGE_BYTES) {
    return { error: "Image is too large. Please use a photo under 2 MB." };
  }

  return { image: { mimeType: image.mimeType, base64: image.base64 } };
}
