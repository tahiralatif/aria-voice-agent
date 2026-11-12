import type { SessionInfo } from "./api";

const RATE = 44100;
const VERSION = "2026-08-14";

export type Role = "user" | "assistant";
export type EngineHandlers = {
  onStatus: (s: "connecting" | "live" | "ended" | "error", detail?: string) => void;
  onTurnStart: (turn: number, role: Role) => void;
  onDelta: (turn: number, role: Role, text: string) => void;
  onTurnEnd: (turn: number, role: Role, text: string | undefined, interrupted: boolean) => void;
};

const roleOf = (r: unknown): Role => (r === "user" ? "user" : "assistant");

export class CallEngine {
  private ws?: WebSocket;
  private ctx?: AudioContext;
  private stream?: MediaStream;
  private node?: AudioWorkletNode;
  private outGain?: GainNode;
  private analyser?: AnalyserNode;
  private sources = new Set<AudioBufferSourceNode>();
  private playHead = 0;
  private ready = false;
  private closed = false;
  private micLevel = 0;
  private buf = new Float32Array(512);

  constructor(private h: EngineHandlers) {}

  /** 0..1 level of the microphone and of Aria's voice, for the visualizer. */
  levels() {
    let out = 0;
    if (this.analyser && this.sources.size > 0) {
      this.analyser.getFloatTimeDomainData(this.buf);
      let s = 0;
      for (let i = 0; i < this.buf.length; i++) s += this.buf[i] * this.buf[i];
      out = Math.min(1, Math.sqrt(s / this.buf.length) * 5);
    }
    return { mic: Math.min(1, this.micLevel * 6), out };
  }

  async start(session: SessionInfo) {
    this.h.onStatus("connecting");
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
    });
    this.ctx = new AudioContext();
    await this.ctx.resume();
    await this.ctx.audioWorklet.addModule("/mic-worklet.js");
    const src = this.ctx.createMediaStreamSource(this.stream);
    this.node = new AudioWorkletNode(this.ctx, "mic-processor", { processorOptions: { targetRate: RATE } });
    src.connect(this.node);
    this.outGain = this.ctx.createGain();
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 512;
    this.outGain.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);

    const base = session.url.replace(/^http/, "ws");
    const sep = base.includes("?") ? "&" : "?";
    const ws = new WebSocket(`${base}${sep}cartesia_version=${VERSION}&access_token=${encodeURIComponent(session.token)}`);
    this.ws = ws;

    this.node.port.onmessage = (e: MessageEvent) => {
      this.micLevel = e.data.level;
      if (!this.ready || ws.readyState !== WebSocket.OPEN) return;
      ws.send(JSON.stringify({ type: "audio_input", audio: toB64(new Uint8Array(e.data.pcm)) }));
    };

    ws.onopen = () =>
      ws.send(JSON.stringify({ type: "session_create", audio: { input_format: `pcm_${RATE}`, output_delivery: "speaking_pace" } }));
    ws.onmessage = (m) => this.onMessage(m.data);
    ws.onerror = () => this.fail("Connection problem. Try again.");
    ws.onclose = () => {
      if (!this.closed) this.finish("ended");
    };
  }

  private onMessage(raw: unknown) {
    if (typeof raw !== "string") return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let d: any;
    try {
      d = JSON.parse(raw);
    } catch {
      return;
    }
    switch (d.type) {
      case "session_ready":
        this.ready = true;
        this.h.onStatus("live");
        break;
      case "audio_output":
        if (d.audio) this.play(fromB64(d.audio));
        break;
      case "audio_output_clear":
        this.stopPlayback();
        break;
      case "turn_started":
        this.h.onTurnStart(d.turn, roleOf(d.role));
        break;
      case "turn_output_text_delta":
        this.h.onDelta(d.turn, roleOf(d.role ?? "assistant"), d.text ?? "");
        break;
      case "turn_ended":
        this.h.onTurnEnd(d.turn, roleOf(d.role), d.text, !!d.interrupted);
        break;
      case "error":
        if (d.fatal) this.fail(d.message || "The call hit an error.");
        break;
    }
  }

  private play(bytes: Uint8Array) {
    const ctx = this.ctx;
    if (!ctx || !this.outGain) return;
    const n = Math.floor(bytes.length / 2);
    if (n === 0) return;
    const view = new DataView(bytes.buffer, bytes.byteOffset, n * 2);
    const ab = ctx.createBuffer(1, n, RATE);
    const ch = ab.getChannelData(0);
    for (let i = 0; i < n; i++) ch[i] = view.getInt16(i * 2, true) / 0x8000;
    const s = ctx.createBufferSource();
    s.buffer = ab;
    s.connect(this.outGain);
    const t = Math.max(ctx.currentTime + 0.03, this.playHead);
    s.start(t);
    this.playHead = t + ab.duration;
    this.sources.add(s);
    s.onended = () => this.sources.delete(s);
  }

  private stopPlayback() {
    this.sources.forEach((s) => {
      s.onended = null;
      try {
        s.stop();
      } catch { /* already stopped */ }
    });
    this.sources.clear();
    this.playHead = 0;
  }

  private fail(msg: string) {
    this.teardown();
    this.h.onStatus("error", msg);
  }

  private finish(s: "ended") {
    this.teardown();
    this.h.onStatus(s);
  }

  private teardown() {
    this.closed = true;
    this.ready = false;
    this.stopPlayback();
    try {
      this.ws?.close();
    } catch { /* already stopped */ }
    this.stream?.getTracks().forEach((t) => t.stop());
    this.node?.disconnect();
    this.ctx?.close().catch(() => {});
  }

  hangUp() {
    if (this.closed) return;
    this.finish("ended");
  }
}

function toB64(u8: Uint8Array) {
  let s = "";
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000));
  return btoa(s);
}
function fromB64(b: string) {
  const s = atob(b);
  const u = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
  return u;
}
