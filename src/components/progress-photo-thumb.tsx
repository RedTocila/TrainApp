"use client";

import { useEffect, useState } from "react";
import { progressPhotoThumbUrl } from "@/lib/progress-photo-urls";

/** Pose slot image. Same crop on screen, decoded from a smaller file when the host allows it. */
export function ProgressPhotoThumb({
  url,
  alt,
  className,
}: {
  url: string;
  alt: string;
  className?: string;
}) {
  const [src, setSrc] = useState(() => progressPhotoThumbUrl(url));

  useEffect(() => {
    setSrc(progressPhotoThumbUrl(url));
  }, [url]);

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      className={className}
      onError={() => {
        setSrc((current) => (current === url ? current : url));
      }}
    />
  );
}
