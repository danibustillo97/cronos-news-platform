export const hostPeerId = (room: string) => `nexus-studio-${room.replace(/[^a-zA-Z0-9]/g, "").toLowerCase()}`;

export const createRoomCode = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(6)), (byte) => "abcdefghjkmnpqrstuvwxyz23456789"[byte % 31]).join("");

export const guestUrl = (origin: string, room: string) => `${origin}/invitado/${room}`;
