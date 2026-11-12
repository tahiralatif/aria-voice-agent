// Captures mic audio, resamples to the target rate, emits Int16 PCM chunks (~40 ms).
class MicProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.target = options.processorOptions.targetRate;
    this.ratio = sampleRate / this.target;
    this.pos = 0;
    this.prev = 0;
    this.out = new Int16Array(Math.round(this.target * 0.04));
    this.n = 0;
    this.level = 0;
  }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (!ch) return true;
    let sum = 0;
    for (let i = 0; i < ch.length; i++) sum += ch[i] * ch[i];
    this.level = Math.sqrt(sum / ch.length);
    // linear-interpolation resampler
    const buf = ch;
    while (this.pos < buf.length) {
      const i = Math.floor(this.pos);
      const f = this.pos - i;
      const a = i === 0 ? this.prev : buf[i - 1];
      const b = buf[i];
      const v = (i === 0 ? a + (b - a) * f : buf[i - 1] + (buf[i] - buf[i - 1]) * f);
      const s = Math.max(-1, Math.min(1, v));
      this.out[this.n++] = s < 0 ? s * 0x8000 : s * 0x7fff;
      if (this.n === this.out.length) {
        const copy = this.out.slice(0);
        this.port.postMessage({ pcm: copy.buffer, level: this.level }, [copy.buffer]);
        this.n = 0;
      }
      this.pos += this.ratio;
    }
    this.pos -= buf.length;
    this.prev = buf[buf.length - 1];
    return true;
  }
}
registerProcessor("mic-processor", MicProcessor);
