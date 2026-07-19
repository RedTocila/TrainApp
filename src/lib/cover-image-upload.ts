import { createAdminClient } from "@/lib/supabase/admin";
import { STORAGE_BUCKETS } from "@/lib/supabase/storage";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_BYTES = 5 * 1024 * 1024;

export async function resolveCoverImageFromForm(
  formData: FormData,
  folder: "classes" | "challenges",
  slug: string
): Promise<string | null> {
  if (formData.get("cover_image_clear") === "on") {
    return null;
  }

  const file = formData.get("cover_image_file");
  if (file instanceof File && file.size > 0) {
    if (!ALLOWED_TYPES.includes(file.type)) {
      throw new Error("Cover image must be JPG, PNG, WebP, or GIF.");
    }
    if (file.size > MAX_BYTES) {
      throw new Error("Cover image must be 5 MB or smaller.");
    }

    const ext =
      file.type === "image/png"
        ? "png"
        : file.type === "image/webp"
          ? "webp"
          : file.type === "image/gif"
            ? "gif"
            : "jpg";
    const path = `${folder}/${slug}-${Date.now()}.${ext}`;
    const admin = createAdminClient();
    const { error } = await admin.storage
      .from(STORAGE_BUCKETS.blogImages)
      .upload(path, file, { upsert: true, cacheControl: "3600" });
    if (error) throw new Error(error.message);

    const { data } = admin.storage.from(STORAGE_BUCKETS.blogImages).getPublicUrl(path);
    return data.publicUrl;
  }

  const url = String(formData.get("cover_image") ?? "").trim();
  return url || null;
}
