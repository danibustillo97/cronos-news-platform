import { beforeAll, describe, expect, it } from "vitest";
import { ProgramMixer, type MixerSource } from "./audioMixer";

class FakeNode {
  outputs = new Set<FakeNode>();
  connect(node: FakeNode) { this.outputs.add(node); return node; }
  disconnect(node?: FakeNode) { if (node) this.outputs.delete(node); else this.outputs.clear(); }
}
const param = (value: number) => ({ value, setTargetAtTime(next: number) { this.value = next; } });
class FakeGain extends FakeNode { gain = param(1); }
class FakePan extends FakeNode { pan = param(0); }

function fakeContext() {
  const created = { streamSources: 0, elementSources: 0 };
  const track = { id: "mix", clone: () => ({ id: "mix-clone" }) };
  const context = {
    currentTime: 0,
    createGain: () => new FakeGain(),
    createStereoPanner: () => new FakePan(),
    createMediaStreamDestination: () => Object.assign(new FakeNode(), { stream: { getAudioTracks: () => [track] } }),
    createMediaStreamSource: () => { created.streamSources += 1; return new FakeNode(); },
    createMediaElementSource: () => { created.elementSources += 1; return new FakeNode(); },
  };
  return { context: context as unknown as AudioContext, created };
}

const stream = (...ids: string[]) => ({ id: ids.join(), getAudioTracks: () => ids.map((id) => ({ id })) }) as unknown as MediaStream;
const mic = (id: string, extra: Partial<MixerSource> = {}): MixerSource => ({ id, stream: stream(`${id}-track`), volume: 0.8, muted: false, ...extra });
const gainOf = (mixer: ProgramMixer, id: string) =>
  (mixer as unknown as { routes: Map<string, { gain: FakeGain }> }).routes.get(id)?.gain.gain.value;

beforeAll(() => {
  globalThis.MediaStream ??= class { constructor(readonly tracks: unknown[]) {} } as unknown as typeof MediaStream;
});

describe("ProgramMixer", () => {
  it("adds a source that connects after the output started", () => {
    const { context } = fakeContext();
    const mixer = new ProgramMixer(context);
    mixer.sync([mic("host")], new Set(["host", "guest"]));
    expect(mixer.routeIds()).toEqual(["host"]);
    mixer.sync([mic("host"), mic("guest")], new Set(["host", "guest"]));
    expect(mixer.routeIds()).toEqual(["host", "guest"]);
    expect(gainOf(mixer, "guest")).toBe(0.8);
  });

  it("only lets Program sources sound, and respects mute", () => {
    const { context } = fakeContext();
    const mixer = new ProgramMixer(context);
    mixer.sync([mic("a"), mic("b"), mic("c", { muted: true })], new Set(["a", "c"]));
    expect([gainOf(mixer, "a"), gainOf(mixer, "b"), gainOf(mixer, "c")]).toEqual([0.8, 0, 0]);
  });

  it("drops removed sources and rebuilds a route when its tracks change", () => {
    const { context, created } = fakeContext();
    const mixer = new ProgramMixer(context);
    mixer.sync([mic("a"), mic("b")], new Set(["a", "b"]));
    mixer.sync([{ ...mic("a"), stream: stream("a-new-track") }], new Set(["a"]));
    expect(mixer.routeIds()).toEqual(["a"]);
    expect(created.streamSources).toBe(3);
  });

  it("wires a media element to the context only once, even across rebuilds", () => {
    const { context, created } = fakeContext();
    const element = { muted: true } as HTMLMediaElement;
    const mixer = new ProgramMixer(context);
    const clip: MixerSource = { id: "clip", element, volume: 1, muted: false };
    mixer.sync([clip], new Set(["clip"]));
    mixer.sync([], new Set());
    mixer.sync([clip], new Set(["clip"]));
    expect(created.elementSources).toBe(1);
    expect(element.muted).toBe(false);
  });

  it("hands out clones of the mix track so stopping an output keeps the mixer alive", () => {
    const { context } = fakeContext();
    expect(new ProgramMixer(context).createTrack()).toEqual({ id: "mix-clone" });
  });
});
