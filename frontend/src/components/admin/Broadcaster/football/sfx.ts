export type SfxKind = "goal" | "yellow" | "red" | "sub" | "var" | "whistle";

let context: AudioContext | null = null;

function ctx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  context ??= new Ctor();
  if (context.state === "suspended") void context.resume();
  return context;
}

function noise(audio: AudioContext, seconds: number): AudioBufferSourceNode {
  const buffer = audio.createBuffer(2, Math.ceil(audio.sampleRate * seconds), audio.sampleRate);
  for (let channel = 0; channel < 2; channel += 1) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
  }
  const source = audio.createBufferSource();
  source.buffer = buffer;
  return source;
}

function tone(audio: AudioContext, out: AudioNode, at: number, freq: number, length: number, gain: number, type: OscillatorType = "sine", pan = 0) {
  const osc = audio.createOscillator();
  const amp = audio.createGain();
  const panner = audio.createStereoPanner();
  osc.type = type;
  osc.frequency.value = freq;
  panner.pan.value = pan;
  amp.gain.setValueAtTime(0.0001, at);
  amp.gain.exponentialRampToValueAtTime(gain, at + 0.02);
  amp.gain.exponentialRampToValueAtTime(0.0001, at + length);
  osc.connect(amp).connect(panner).connect(out);
  osc.start(at);
  osc.stop(at + length + 0.05);
}

// Stadium-style wash: filtered noise swelling across the stereo field, with a short echo for width.
function crowd(audio: AudioContext, out: AudioNode, at: number, seconds: number, peak: number) {
  const source = noise(audio, seconds);
  const filter = audio.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(500, at);
  filter.frequency.linearRampToValueAtTime(1400, at + seconds * 0.4);
  filter.Q.value = 0.6;
  const amp = audio.createGain();
  amp.gain.setValueAtTime(0.0001, at);
  amp.gain.exponentialRampToValueAtTime(peak, at + seconds * 0.3);
  amp.gain.exponentialRampToValueAtTime(0.0001, at + seconds);
  const echo = audio.createDelay(0.5);
  echo.delayTime.value = 0.23;
  const feedback = audio.createGain();
  feedback.gain.value = 0.35;
  source.connect(filter).connect(amp);
  amp.connect(out);
  amp.connect(echo);
  echo.connect(feedback).connect(echo);
  echo.connect(out);
  source.start(at);
}

/** Where an effect plays besides the local speakers: the program bus, so it is heard on air. */
export interface SfxBus {
  context: AudioContext;
  node: AudioNode;
}

export function playSfx(kind: SfxKind, volume = 0.7, bus?: SfxBus) {
  const audio = bus?.context ?? ctx();
  if (!audio) return;
  if (audio.state === "suspended") void audio.resume();
  const master = audio.createGain();
  master.gain.value = volume;
  master.connect(audio.destination);
  if (bus) master.connect(bus.node);
  const now = audio.currentTime + 0.02;
  switch (kind) {
    case "goal":
      crowd(audio, master, now, 4.2, 0.35);
      [261.63, 329.63, 392, 523.25].forEach((freq, index) => tone(audio, master, now + index * 0.07, freq, 1.4, 0.14, "triangle", index % 2 ? 0.5 : -0.5));
      tone(audio, master, now, 65.4, 0.9, 0.35, "sine");
      break;
    case "yellow":
      tone(audio, master, now, 880, 0.12, 0.16, "square", -0.3);
      tone(audio, master, now + 0.14, 880, 0.3, 0.16, "square", 0.3);
      break;
    case "red":
      tone(audio, master, now, 660, 0.14, 0.18, "square", -0.4);
      tone(audio, master, now + 0.16, 660, 0.14, 0.18, "square", 0.4);
      tone(audio, master, now + 0.32, 440, 0.55, 0.2, "sawtooth", 0);
      break;
    case "sub":
      tone(audio, master, now, 523.25, 0.18, 0.12, "sine", -0.3);
      tone(audio, master, now + 0.14, 783.99, 0.3, 0.12, "sine", 0.3);
      break;
    case "var":
      [0, 0.18, 0.36].forEach((offset, index) => tone(audio, master, now + offset, 1200 - index * 150, 0.1, 0.1, "sine", index - 1));
      break;
    case "whistle":
      tone(audio, master, now, 2900, 0.5, 0.12, "sine");
      break;
  }
}
