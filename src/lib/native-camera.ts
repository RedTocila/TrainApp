import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import { Capacitor } from "@capacitor/core";

function dataUrlToFile(dataUrl: string, filename: string): File {
  const [header, data] = dataUrl.split(",");
  const mime =
    /data:(.*?);/.exec(header)?.[1] ?? "image/jpeg";
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new File([bytes], filename, { type: mime });
}

/**
 * Prefer Capacitor Camera in the native shell; returns null on web so callers
 * can fall back to `<input capture>` / getUserMedia.
 */
export async function pickNativeImage(options: {
  source: "camera" | "gallery";
}): Promise<File | null> {
  if (!Capacitor.isNativePlatform()) return null;

  const photo = await Camera.getPhoto({
    quality: 85,
    resultType: CameraResultType.DataUrl,
    source:
      options.source === "camera" ? CameraSource.Camera : CameraSource.Photos,
    correctOrientation: true,
  });

  if (!photo.dataUrl) return null;
  const ext = photo.format === "png" ? "png" : "jpg";
  return dataUrlToFile(
    photo.dataUrl,
    `rutina-${options.source}-${Date.now()}.${ext}`,
  );
}
