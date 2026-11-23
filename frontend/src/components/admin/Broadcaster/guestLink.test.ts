import { describe, expect, it } from "vitest";
import { createRoomCode, hostPeerId, peerOptions } from "./guestLink";

describe("guest link", () => {
  it("adds configured TURN servers after the default STUN server", () => {
    const turn = { urls: "turn:turn.example.com:3478", username: "u", credential: "c" };
    expect(peerOptions(JSON.stringify([turn])).config?.iceServers).toEqual([{ urls: "stun:stun.l.google.com:19302" }, turn]);
  });

  it("ignores missing or malformed ICE configuration instead of breaking the call", () => {
    expect(peerOptions(undefined)).toEqual({});
    expect(peerOptions("not json")).toEqual({});
    expect(peerOptions(JSON.stringify([{ username: "no urls" }]))).toEqual({});
  });

  it("derives a stable host id from the room code", () => {
    const room = createRoomCode();
    expect(room).toMatch(/^[a-z2-9]{6}$/);
    expect(hostPeerId(room)).toBe(`nexus-studio-${room}`);
  });
});
