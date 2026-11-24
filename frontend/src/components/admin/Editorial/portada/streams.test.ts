import { describe, expect, it } from "vitest";
import { detectStreamKind, isPlayableAudio, isPlayableVideo } from "./streams";

describe("detectStreamKind", () => {
  it.each([
    ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", "youtube"],
    ["https://youtu.be/dQw4w9WgXcQ", "youtube"],
    ["https://www.youtube.com/live/dQw4w9WgXcQ", "youtube"],
    ["https://www.twitch.tv/canal", "twitch"],
    ["https://kick.com/nexusnews", "kick"],
    ["https://player.kick.com/nexusnews", "kick"],
    ["https://kick.com/categories/futbol", "unknown"],
    ["https://www.facebook.com/nexus/videos/123", "facebook"],
    ["https://cdn.test/live/master.m3u8", "hls"],
    ["https://cdn.test/clip.mp4", "video-file"],
    ["https://stream.zeno.fm/abc123", "audio"],
    ["https://radio.test/live.mp3", "audio"],
    ["https://icecast.test:8000/stream", "audio"],
    ["javascript:alert(1)", "unknown"],
    ["no es una url", "unknown"],
  ])("%s -> %s", (url, kind) => {
    expect(detectStreamKind(url)).toBe(kind);
  });

  it("classifies what each stage mode can play", () => {
    expect(isPlayableVideo("youtube")).toBe(true);
    expect(isPlayableVideo("audio")).toBe(false);
    expect(isPlayableAudio("hls")).toBe(true);
    expect(isPlayableAudio("youtube")).toBe(false);
  });
});
