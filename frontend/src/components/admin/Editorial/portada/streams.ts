// What kind of live source an URL is -- so the editor can tell, before
// applying, whether the portal will be able to play it.

export type StreamKind = "youtube" | "twitch" | "kick" | "facebook" | "hls" | "video-file" | "audio" | "unknown";

export const STREAM_LABEL: Record<StreamKind, string> = {
  youtube: "YouTube",
  twitch: "Twitch",
  kick: "Kick",
  facebook: "Facebook Video",
  hls: "HLS (.m3u8)",
  "video-file": "Archivo de video",
  audio: "Audio en directo",
  unknown: "Formato no reconocido",
};

export function detectStreamKind(raw: string): StreamKind {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return "unknown";
  }
  if (!/^https?:$/.test(url.protocol)) return "unknown";
  const host = url.hostname.replace(/^www\.|^m\./, "");
  const path = url.pathname.toLowerCase();
  if (host === "youtu.be" || host.endsWith("youtube.com") || host.endsWith("youtube-nocookie.com")) return "youtube";
  if (host.endsWith("twitch.tv")) return "twitch";
  if (host === "kick.com" || host === "player.kick.com") return /^\/[A-Za-z0-9_-]+\/?$/.test(url.pathname) ? "kick" : "unknown";
  if (host.endsWith("facebook.com") || host === "fb.watch") return "facebook";
  if (path.endsWith(".m3u8")) return "hls";
  if (/\.(mp4|webm|mov)$/.test(path)) return "video-file";
  if (/\.(mp3|aac|ogg|opus|m4a|pls)$/.test(path) || /\/(stream|live|radio|listen)(\/|$|\.)/.test(path) || /icecast|shoutcast|zeno\.fm|radio/.test(host)) return "audio";
  return "unknown";
}

export function isPlayableVideo(kind: StreamKind): boolean {
  return kind === "youtube" || kind === "twitch" || kind === "kick" || kind === "facebook" || kind === "hls" || kind === "video-file";
}

export function isPlayableAudio(kind: StreamKind): boolean {
  return kind === "audio" || kind === "hls";
}
