export const hostPeerId = (room: string) => `nexus-studio-${room.replace(/[^a-zA-Z0-9]/g, "").toLowerCase()}`;

export const createRoomCode = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(6)), (byte) => "abcdefghjkmnpqrstuvwxyz23456789"[byte % 31]).join("");

export const guestUrl = (origin: string, room: string) => `${origin}/invitado/${room}`;

/**
 * PeerJS options shared by the studio and the guest page. Without a TURN server, guests behind
 * strict NAT (many mobile and corporate networks) cannot connect, so NEXT_PUBLIC_ICE_SERVERS can
 * provide one as JSON: [{"urls":"turn:turn.example.com:3478","username":"…","credential":"…"}].
 */
export function peerOptions(raw = process.env.NEXT_PUBLIC_ICE_SERVERS): { config?: RTCConfiguration } {
  if (!raw) return {};
  try {
    const servers: unknown = JSON.parse(raw);
    if (!Array.isArray(servers) || !servers.every((server) => server && (typeof server.urls === "string" || Array.isArray(server.urls)))) return {};
    return { config: { iceServers: [{ urls: "stun:stun.l.google.com:19302" }, ...(servers as RTCIceServer[])] } };
  } catch {
    return {};
  }
}
