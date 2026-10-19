// Audio helpers that run in the browser: waveform peaks, and raw microphone recording to WAV.

/** Peak envelope for drawing a waveform (values 0..1). */
export async function waveformPeaks(blob, bars = 120) {
  const ctx = new OfflineAudioContext(1, 1, 16000);   // decodes and resamples to 16 kHz
  const buf = await ctx.decodeAudioData(await blob.arrayBuffer());
  const data = buf.getChannelData(0);
  const step = Math.max(1, Math.floor(data.length / bars));
  const peaks = [];
  for (let i = 0; i < bars; i++) {
    let max = 0;
    for (let j = i * step; j < Math.min(data.length, (i + 1) * step); j++) max = Math.max(max, Math.abs(data[j]));
    peaks.push(max);
  }
  const top = Math.max(...peaks, 1e-6);
  return { peaks: peaks.map((p) => p / top), duration: buf.duration };
}

/** 16-bit PCM mono WAV file from Float32 samples. */
export function encodeWav(samples, sampleRate) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const v = new DataView(buffer);
  const str = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, "RIFF"); v.setUint32(4, 36 + samples.length * 2, true); str(8, "WAVE");
  str(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, sampleRate, true); v.setUint32(28, sampleRate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  str(36, "data"); v.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buffer], { type: "audio/wav" });
}

// AudioWorklet that hands raw microphone samples to the page (no compression, no codec).
const WORKLET = `
class Capture extends AudioWorkletProcessor {
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (ch) this.port.postMessage(ch.slice(0));
    return true;
  }
}
registerProcessor("capture", Capture);
`;

export function micErrorMessage(err) {
  if (!window.isSecureContext) return "The microphone only works on https or on localhost. Open the app at http://localhost:5173.";
  switch (err?.name) {
    case "NotAllowedError":
    case "SecurityError":
      return "Microphone access was blocked. Click the lock or mic icon in the address bar, allow the microphone, then try again.";
    case "NotFoundError":
    case "OverconstrainedError":
      return "No microphone was found. Connect one, or use Upload instead.";
    case "NotReadableError":
      return "The microphone is being used by another app. Close it and try again.";
    default:
      return `Could not start the microphone (${err?.message || "unknown error"}).`;
  }
}

/**
 * Start recording raw audio from the microphone.
 * Browser noise suppression, echo cancellation and auto-gain are turned OFF on purpose:
 * that processing alters the voice in ways a deepfake detector can mistake for synthesis.
 * Returns { analyser, stop(): Promise<{ blob, duration }>, cancel() }.
 */
export async function startRecording() {
  if (!navigator.mediaDevices?.getUserMedia) throw Object.assign(new Error("not supported"), { name: "NotSupportedError" });
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { channelCount: 1, echoCancellation: false, noiseSuppression: false, autoGainControl: false },
  });
  const ctx = new AudioContext();
  const url = URL.createObjectURL(new Blob([WORKLET], { type: "text/javascript" }));
  await ctx.audioWorklet.addModule(url);
  URL.revokeObjectURL(url);

  const source = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 2048;
  const node = new AudioWorkletNode(ctx, "capture");
  const chunks = [];
  node.port.onmessage = (e) => chunks.push(e.data);
  const mute = ctx.createGain();
  mute.gain.value = 0;    // keeps the worklet running without playing the mic back through the speakers
  source.connect(analyser);
  source.connect(node);
  node.connect(mute).connect(ctx.destination);

  const close = async () => {
    stream.getTracks().forEach((t) => t.stop());
    source.disconnect();
    node.disconnect();
    mute.disconnect();
    if (ctx.state !== "closed") await ctx.close();
  };

  return {
    analyser,
    async stop() {
      await close();
      const length = chunks.reduce((n, c) => n + c.length, 0);
      const samples = new Float32Array(length);
      let o = 0;
      for (const c of chunks) { samples.set(c, o); o += c.length; }
      return { blob: encodeWav(samples, ctx.sampleRate), duration: length / ctx.sampleRate };
    },
    cancel: close,
  };
}
