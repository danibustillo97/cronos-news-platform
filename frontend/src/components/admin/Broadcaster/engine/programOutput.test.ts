import { describe, expect, it } from "vitest";
import { fpsOf, preferCodecs, tuneVideoBitrate, OUTPUT_BITRATE_KBPS } from "./programOutput";

const SDP = [
  "v=0",
  "m=audio 9 UDP/TLS/RTP/SAVPF 111",
  "a=rtpmap:111 opus/48000/2",
  "a=fmtp:111 minptime=10;useinbandfec=1",
  "m=video 9 UDP/TLS/RTP/SAVPF 96 97 102",
  "a=rtpmap:96 VP8/90000",
  "a=rtpmap:97 rtx/90000",
  "a=fmtp:97 apt=96",
  "a=rtpmap:102 H264/90000",
  "a=fmtp:102 level-asymmetry-allowed=1;packetization-mode=1;x-google-max-bitrate=500",
  "",
].join("\r\n");

describe("Broadcast Output link", () => {
  it("raises the encoder bitrate on every video codec, never on audio or retransmission", () => {
    const out = tuneVideoBitrate(SDP);
    const extra = `x-google-min-bitrate=${OUTPUT_BITRATE_KBPS.min};x-google-start-bitrate=${OUTPUT_BITRATE_KBPS.start};x-google-max-bitrate=${OUTPUT_BITRATE_KBPS.max}`;
    expect(out).toContain(`a=fmtp:96 ${extra}`); // VP8 had no fmtp: one is added after its rtpmap
    expect(out).toContain(`a=fmtp:102 level-asymmetry-allowed=1;packetization-mode=1;${extra}`); // stale x-google value replaced
    expect(out).not.toContain("x-google-max-bitrate=500");
    expect(out).toContain("a=fmtp:111 minptime=10;useinbandfec=1"); // audio untouched
    expect(out).toContain("a=fmtp:97 apt=96"); // rtx untouched
    expect(out.split("\r\n").filter((l) => l.startsWith("a=fmtp:96")).length).toBe(1);
  });

  it("prefers H.264 (hardware, low CPU) and keeps retransmission codecs after the real ones", () => {
    const order = preferCodecs([{ mimeType: "video/rtx" }, { mimeType: "video/VP9" }, { mimeType: "video/VP8" }, { mimeType: "video/H264" }]).map((c) => c.mimeType);
    expect(order).toEqual(["video/H264", "video/VP8", "video/VP9", "video/rtx"]);
  });

  it("measures real presented fps over the last window", () => {
    const at30 = Array.from({ length: 61 }, (_, i) => i * (1000 / 30));
    expect(fpsOf(at30)).toBe(30);
    const at15 = Array.from({ length: 31 }, (_, i) => i * (1000 / 15));
    expect(fpsOf(at15)).toBe(15);
    expect(fpsOf([0])).toBe(0);
    // an old burst followed by a long gap does not inflate the figure
    expect(fpsOf([0, 33, 66, 5000])).toBe(0);
  });
});
