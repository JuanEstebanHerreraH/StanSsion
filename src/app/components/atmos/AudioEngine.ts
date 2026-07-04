// ─── Ambient Sound Engine (sample-based) ──────────────────────────────────────
// Built-in samples: Rain (lluvia.mp3), Forest (bosque.mp3) — seamless loops.
// Unlimited user "custom" sounds: uploaded MP3/WAV stored in IndexedDB so they
// persist across reloads. Ocean (synth) removed — replaced by real recordings.
//
// Per-sound controls:
//   Intensity = volume (gain)
//   Speed     = playbackRate (0.5x dreamy → 1.6x energetic)
//   Density   = lowpass cutoff (300 Hz muffled → 20 kHz fully open)

import rainUrl   from "../../../assets/lluvia.mp3";
import forestUrl from "../../../assets/bosque.mp3";

export const BUILTIN_SOUNDS = [
  { id: "rain",   nameKey: "ambRain",   emoji: "🌧", url: rainUrl },
  { id: "forest", nameKey: "ambForest", emoji: "🌿", url: forestUrl },
] as const;

// ─── IndexedDB helper for custom audio blobs ──────────────────────────────────
const DB_NAME = "stanssion";
const STORE   = "ambient";

function idb(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains(STORE)) r.result.createObjectStore(STORE); };
    r.onsuccess = () => res(r.result);
    r.onerror   = () => rej(r.error);
  });
}
export async function idbPut(id: string, blob: Blob) {
  const db = await idb();
  return new Promise<void>((res, rej) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(blob, id);
    tx.oncomplete = () => res();
    tx.onerror    = () => rej(tx.error);
  });
}
export async function idbGet(id: string): Promise<Blob | undefined> {
  const db = await idb();
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE, "readonly");
    const rq = tx.objectStore(STORE).get(id);
    rq.onsuccess = () => res(rq.result as Blob | undefined);
    rq.onerror   = () => rej(rq.error);
  });
}
export async function idbDelete(id: string) {
  const db = await idb();
  return new Promise<void>((res) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => res();
    tx.onerror    = () => res();
  });
}

export interface SoundRef { id: string; builtin: boolean; url?: string; }

interface Handle {
  stop:     (fade?: boolean) => void;
  updateI:  (v: number) => void;
  updateSp: (v: number) => void;
  updateDe: (v: number) => void;
}

export class AmbientEngine {
  private ctx:        AudioContext | null = null;
  private masterGain: GainNode     | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private analyser:   AnalyserNode  | null = null;
  private handle:     Handle        | null = null;
  private _vol = 0.75;
  private _normalize = false;
  private _crossfade = true;
  private bufferCache = new Map<string, AudioBuffer>();

  private boot(): AudioContext {
    if (this.ctx && this.ctx.state !== "closed") {
      if (this.ctx.state === "suspended") this.ctx.resume();
      return this.ctx;
    }
    this.ctx      = new AudioContext();
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize               = 128;
    this.analyser.smoothingTimeConstant = 0.85;
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this._vol;
    this.rebuildChain();
    return this.ctx;
  }

  private rebuildChain() {
    if (!this.ctx || !this.masterGain || !this.analyser) return;
    try { this.masterGain.disconnect(); } catch {}
    try { this.compressor?.disconnect(); } catch {}
    try { this.analyser.disconnect(); } catch {}
    if (this._normalize) {
      if (!this.compressor) {
        this.compressor = this.ctx.createDynamicsCompressor();
        this.compressor.threshold.value = -18;
        this.compressor.knee.value      = 24;
        this.compressor.ratio.value     = 6;
        this.compressor.attack.value    = 0.004;
        this.compressor.release.value   = 0.25;
      }
      this.masterGain.connect(this.compressor);
      this.compressor.connect(this.analyser);
    } else {
      this.masterGain.connect(this.analyser);
    }
    this.analyser.connect(this.ctx.destination);
  }

  private ramp(p: AudioParam, to: number, ctx: AudioContext, t = 0.2) {
    p.setTargetAtTime(to, ctx.currentTime, t);
  }

  private async getBuffer(ref: SoundRef): Promise<AudioBuffer | null> {
    const ctx = this.boot();
    if (this.bufferCache.has(ref.id)) return this.bufferCache.get(ref.id)!;
    let ab: ArrayBuffer | null = null;
    try {
      if (ref.builtin && ref.url) {
        ab = await (await fetch(ref.url)).arrayBuffer();
      } else {
        const blob = await idbGet(ref.id);
        if (blob) ab = await blob.arrayBuffer();
      }
    } catch { return null; }
    if (!ab) return null;
    const buf = await ctx.decodeAudioData(ab);
    this.bufferCache.set(ref.id, buf);
    return buf;
  }

  private startBuffer(ctx: AudioContext, buffer: AudioBuffer, i: number, sp: number, de: number): Handle {
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop   = true;
    src.playbackRate.value = 0.5 + (sp / 100) * 1.1;          // 0.5x → 1.6x

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 300 + (de / 100) * 19700;         // 300 Hz → 20 kHz

    const g = ctx.createGain();
    const target = (i / 100) * 0.9;
    g.gain.value = this._crossfade ? 0 : target;

    src.connect(filter); filter.connect(g); g.connect(this.masterGain!);
    src.start();
    if (this._crossfade) this.ramp(g.gain, target, ctx, 0.4);

    return {
      stop: (fade = false) => {
        if (fade && this._crossfade) {
          this.ramp(g.gain, 0, ctx, 0.25);
          setTimeout(() => { try { src.stop(); } catch {} }, 600);
        } else { try { src.stop(); } catch {} }
      },
      updateI:  v => this.ramp(g.gain, (v / 100) * 0.9, ctx),
      updateSp: v => this.ramp(src.playbackRate, 0.5 + (v / 100) * 1.1, ctx),
      updateDe: v => this.ramp(filter.frequency, 300 + (v / 100) * 19700, ctx),
    };
  }

  // ── Public API ──────────────────────────────────────────────────────────
  async play(ref: SoundRef, i: number, sp: number, de: number): Promise<boolean> {
    const ctx = this.boot();
    const buffer = await this.getBuffer(ref);
    if (!buffer) { this.stop(); return false; }
    this.handle?.stop(true);
    this.handle = this.startBuffer(ctx, buffer, i, sp, de);
    return true;
  }

  stop() { this.handle?.stop(true); this.handle = null; }

  updateParams(i: number, sp: number, de: number) {
    this.handle?.updateI(i);
    this.handle?.updateSp(sp);
    this.handle?.updateDe(de);
  }

  evictCache(id: string) { this.bufferCache.delete(id); }

  setVolume(v: number) {
    this._vol = v / 100;
    if (this.masterGain && this.ctx)
      this.masterGain.gain.setTargetAtTime(this._vol, this.ctx.currentTime, 0.05);
  }
  setNormalize(on: boolean) { this._normalize = on; this.rebuildChain(); }
  setCrossfade(on: boolean) { this._crossfade = on; }
  get normalize() { return this._normalize; }
  get crossfade() { return this._crossfade; }

  getFrequencyData(arr: Uint8Array) { this.analyser?.getByteFrequencyData(arr as Uint8Array<ArrayBuffer>); }
  get isPlaying()    { return this.handle !== null; }
  get analyserNode() { return this.analyser; }
  resume() { this.ctx?.resume(); }
}

export const ambientEngine = new AmbientEngine();
