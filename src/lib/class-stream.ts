import { isValidYoutubeUrl } from "@/lib/youtube";

export function getClassStreamUrl(
  meetingUrl: string | null,
  replayUrl: string | null,
  preferReplay: boolean
): string | null {
  if (preferReplay && replayUrl && isValidYoutubeUrl(replayUrl)) return replayUrl;
  if (meetingUrl && isValidYoutubeUrl(meetingUrl)) return meetingUrl;
  if (replayUrl && isValidYoutubeUrl(replayUrl)) return replayUrl;
  return null;
}
