// Program audio mix: one route (source → gain → pan → master) per source that carries sound.
// Routes are reconciled whenever sources change, so a guest or a microphone that connects
// mid-broadcast is heard on air without restarting the output.

export interface MixerSource {
  id: string;
  stream?: MediaStream;
  /** Pool element of a file video; its sound reaches the mix through a media element source. */
  element?: HTMLMediaElement;
  volume: number;
  pan?: number;
  muted: boolean;
}

interface Route {
  key: string;
  source: AudioNode;
  gain: GainNode;
  pan: StereoPannerNode;
}

// A media element can be wired to a single AudioContext only once, for its whole life.
const elementSources = new WeakMap<HTMLMediaElement, MediaElementAudioSourceNode>();

const RAMP = 0.02;

function routeKey(source: MixerSource): string | null {
  const tracks = source.stream?.getAudioTracks() ?? [];
  if (tracks.length) return `stream:${tracks.map((track) => track.id).join(",")}`;
  return source.element ? "element" : null;
}

export class ProgramMixer {
  readonly destination: MediaStreamAudioDestinationNode;
  /** Program bus: every route and every sound effect goes through it. */
  readonly master: GainNode;
  private readonly routes = new Map<string, Route & { element?: HTMLMediaElement }>();

  constructor(readonly context: AudioContext, masterVolume = 1) {
    this.destination = context.createMediaStreamDestination();
    this.master = context.createGain();
    this.master.gain.value = masterVolume;
    this.master.connect(this.destination);
  }

  /** Creates, rebuilds or drops routes to match `sources`; only sources in Program sound. */
  sync(sources: MixerSource[], programIds: ReadonlySet<string>) {
    const seen = new Set<string>();
    for (const source of sources) {
      const key = routeKey(source);
      if (!key) continue;
      seen.add(source.id);
      let route = this.routes.get(source.id);
      if (route && (route.key !== key || (key === "element" && route.element !== source.element))) {
        this.drop(source.id);
        route = undefined;
      }
      if (!route) route = this.connect(source, key);
      const enabled = programIds.has(source.id) && !source.muted;
      const now = this.context.currentTime;
      route.gain.gain.setTargetAtTime(enabled ? source.volume : 0, now, RAMP);
      route.pan.pan.setTargetAtTime(source.pan ?? 0, now, RAMP);
    }
    for (const id of [...this.routes.keys()]) if (!seen.has(id)) this.drop(id);
  }

  setMasterVolume(volume: number) {
    this.master.gain.setTargetAtTime(volume, this.context.currentTime, RAMP);
  }

  /** A fresh audio track of the mix; stopping it does not affect the mixer. */
  createTrack(): MediaStreamTrack | null {
    return this.destination.stream.getAudioTracks()[0]?.clone() ?? null;
  }

  routeIds(): string[] {
    return [...this.routes.keys()];
  }

  dispose() {
    for (const id of [...this.routes.keys()]) this.drop(id);
    this.master.disconnect();
  }

  private connect(source: MixerSource, key: string) {
    let node: AudioNode;
    if (key === "element" && source.element) {
      const element = source.element;
      let media = elementSources.get(element);
      if (!media) {
        media = this.context.createMediaElementSource(element);
        elementSources.set(element, media);
      }
      // Once routed, the element only sounds through the mix, so unmuting it is safe.
      element.muted = false;
      node = media;
    } else {
      node = this.context.createMediaStreamSource(new MediaStream(source.stream!.getAudioTracks()));
    }
    const gain = this.context.createGain();
    gain.gain.value = 0;
    const pan = this.context.createStereoPanner();
    node.connect(gain);
    gain.connect(pan);
    pan.connect(this.master);
    const route = { key, source: node, gain, pan, element: key === "element" ? source.element : undefined };
    this.routes.set(source.id, route);
    return route;
  }

  private drop(id: string) {
    const route = this.routes.get(id);
    if (!route) return;
    route.source.disconnect(route.gain);
    route.gain.disconnect();
    route.pan.disconnect();
    this.routes.delete(id);
  }
}
