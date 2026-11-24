// Minimal WHIP (WebRTC-HTTP Ingestion) publisher, shared by the radio station.
// Same protocol the video studio uses: POST an SDP offer, get the answer and a
// resource URL; DELETE the resource to stop. The local gateway (MediaMTX)
// re-broadcasts it (RTMP to Kick/TikTok, Icecast to Zeno.fm).

export interface WhipSession {
  peer: RTCPeerConnection;
  resource: string;
  stop: () => Promise<void>;
}

export const LOCAL_GATEWAY = "http://localhost:8889";

export function gatewayEndpoint(path: "live" | "radio", base = LOCAL_GATEWAY): string {
  return `${base.replace(/\/$/, "")}/${path}/whip`;
}

export function validateWhipUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new Error("La URL del puente no es válida");
  }
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (url.protocol !== "https:" && !(local && url.protocol === "http:")) {
    throw new Error("El puente debe usar HTTPS (o http://localhost para el puente local)");
  }
  return url;
}

export async function publishWhip(
  stream: MediaStream, rawUrl: string, token = "",
  onLost?: () => void,
): Promise<WhipSession> {
  const endpoint = validateWhipUrl(rawUrl);
  const peer = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
  try {
    stream.getTracks().forEach((track) => peer.addTransceiver(track, { direction: "sendonly", streams: [stream] }));
    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    if (peer.iceGatheringState !== "complete") {
      await new Promise<void>((resolve) => {
        const done = () => { if (peer.iceGatheringState === "complete") resolve(); };
        peer.addEventListener("icegatheringstatechange", done);
        window.setTimeout(resolve, 4000); // send what we have; MediaMTX handles trickle-less offers
      });
    }
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/sdp", Accept: "application/sdp", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: peer.localDescription?.sdp ?? "",
    });
    if (!response.ok) throw new Error(`El puente respondió HTTP ${response.status}. ¿Está encendido?`);
    const answer = await response.text();
    const location = response.headers.get("Location");
    if (!answer || !location) throw new Error("El puente no devolvió una respuesta WHIP válida");
    await peer.setRemoteDescription({ type: "answer", sdp: answer });
    const resource = new URL(location, endpoint).toString();
    peer.addEventListener("connectionstatechange", () => {
      if (peer.connectionState === "failed") onLost?.();
    });
    return {
      peer, resource,
      stop: async () => {
        peer.close();
        try {
          await fetch(resource, { method: "DELETE", headers: token ? { Authorization: `Bearer ${token}` } : undefined });
        } catch {
          // gateway already gone: nothing to tear down
        }
      },
    };
  } catch (error) {
    peer.close();
    if (error instanceof TypeError) throw new Error("No se pudo conectar con el puente local. Ábrelo con start-gateway.ps1 y reintenta.");
    throw error;
  }
}
