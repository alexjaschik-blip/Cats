'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

// ─── Real meow sounds ─────────────────────────────────────────────────────────
// redjamie7: CC BY 4.0 · freesound.org/people/redjamie7/packs/40688
// lukey1028: free to use · freesound.org/people/lukey1028
// timtube:   CC BY 4.0 · freesound.org/people/timtube
const MEOW_FILES = [
  '/sounds/729021__redjamie7__cat-festus-meow-1.mp3',
  '/sounds/729022__redjamie7__cat-festus-meow-2.mp3',
  '/sounds/729023__redjamie7__cat-festus-meow-3.mp3',
  '/sounds/729024__redjamie7__cat-festus-meow-4.mp3',
  '/sounds/729025__redjamie7__cat-festus-meow-5.mp3',
  '/sounds/729026__redjamie7__cat-festus-meow-6.mp3',
  '/sounds/729027__redjamie7__cat-festus-meow-7.mp3',
  '/sounds/729031__redjamie7__cat-smokey-meow-1.mp3',
  '/sounds/729032__redjamie7__cat-smokey-meow-2.mp3',
  '/sounds/732519__lukey1028__senior-cat-meow.mp3',
  '/sounds/732520__lukey1028__young-cat-meow.mp3',
  '/sounds/732521__lukey1028__begging-meow.mp3',
  '/sounds/58981__timtube__rabble-meowing.wav',
  '/sounds/61043__timtube__rabble-meowing-2.wav',
  '/sounds/61259__timtube__cat-meowing.wav',
];

// Preload at module level so first click is instant
let _meowPool: HTMLAudioElement[] = [];
function getMeowPool(): HTMLAudioElement[] {
  if (typeof window === 'undefined') return [];
  if (_meowPool.length === 0) {
    _meowPool = MEOW_FILES.map(src => {
      const a = new Audio(src);
      a.preload = 'auto';
      return a;
    });
  }
  return _meowPool;
}

export function useCatMeow() {
  return useCallback(() => {
    const pool = getMeowPool();
    if (pool.length === 0) return;
    // Clone so multiple meows can overlap freely
    const base = pool[Math.floor(Math.random() * pool.length)];
    const clone = base.cloneNode() as HTMLAudioElement;
    clone.volume = 0.65 + Math.random() * 0.35;
    clone.play().catch(() => {/* blocked until user gesture — fine */});
  }, []);
}

// ─── Background music engine (Web Audio lofi synthesis) ───────────────────────
const TRACKS = [
  { id: 0, name: 'Plaka Midnight',     bpm: 72,  key: 57, mood: 'minor'  as const },
  { id: 1, name: 'Roof of Exarcheia', bpm: 84,  key: 60, mood: 'minor'  as const },
  { id: 2, name: 'Kolonaki Dusk',     bpm: 65,  key: 62, mood: 'major'  as const },
  { id: 3, name: 'Monastiraki Jazz',  bpm: 96,  key: 55, mood: 'dorian' as const },
];

type Mood = 'minor' | 'major' | 'dorian';

const SCALES: Record<Mood, number[]> = {
  minor:  [0, 2, 3, 5, 7, 8, 10, 12],
  major:  [0, 2, 4, 5, 7, 9, 11, 12],
  dorian: [0, 2, 3, 5, 7, 9, 10, 12],
};

function midiToHz(midi: number) { return 440 * Math.pow(2, (midi - 69) / 12); }

class CatAudioEngine {
  ctx: AudioContext;
  master: GainNode;
  lopass: BiquadFilterNode;  // Lofi warmth filter
  reverb: ConvolverNode;
  reverbGain: GainNode;
  dryGain: GainNode;
  currentTrackIdx = 0;
  isPlaying = false;
  nextBeatTime = 0;
  scheduleAhead = 0.35;
  lookahead = 25;
  timerID: ReturnType<typeof setInterval> | null = null;
  beatCount = 0;
  volume = 0.45;

  constructor() {
    this.ctx = new AudioContext();

    this.master = this.ctx.createGain();
    this.master.gain.value = this.volume;
    this.master.connect(this.ctx.destination);

    // Low-pass makes the synth sound warmer / less digital
    this.lopass = this.ctx.createBiquadFilter();
    this.lopass.type = 'lowpass';
    this.lopass.frequency.value = 3200;
    this.lopass.Q.value = 0.5;
    this.lopass.connect(this.master);

    this.reverb = this.ctx.createConvolver();
    this.buildReverb();

    this.reverbGain = this.ctx.createGain();
    this.reverbGain.gain.value = 0.3;
    this.dryGain = this.ctx.createGain();
    this.dryGain.gain.value = 0.7;

    this.reverb.connect(this.reverbGain);
    this.reverbGain.connect(this.lopass);
    this.dryGain.connect(this.lopass);
  }

  buildReverb() {
    const rate   = this.ctx.sampleRate;
    const length = rate * 3;
    const buf    = this.ctx.createBuffer(2, length, rate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2.8);
      }
    }
    this.reverb.buffer = buf;
  }

  setVolume(v: number) {
    this.volume = v;
    this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05);
  }

  note(freq: number, t: number, dur: number, type: OscillatorType, gain: number, pan = 0) {
    const osc  = this.ctx.createOscillator();
    const g    = this.ctx.createGain();
    const pan_ = this.ctx.createStereoPanner();

    osc.type = type;
    osc.frequency.value = freq;
    pan_.pan.value = pan;

    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.015);
    g.gain.setTargetAtTime(0, t + dur * 0.65, dur * 0.22);

    osc.connect(g); g.connect(pan_);
    pan_.connect(this.dryGain);
    pan_.connect(this.reverb);

    osc.start(t); osc.stop(t + dur + 0.4);
  }

  scheduleBeats() {
    const track  = TRACKS[this.currentTrackIdx];
    const beat_s = 60 / track.bpm;
    const scale  = SCALES[track.mood];
    const root   = track.key;

    while (this.nextBeatTime < this.ctx.currentTime + this.scheduleAhead) {
      const t    = this.nextBeatTime;
      const beat = this.beatCount % 32; // 8 bars of 4/4

      // ── Bass ───────────────────────────────────────────────────────────────
      if (beat % 4 === 0) {
        const bassRoot = root - 24 + scale[Math.floor(Math.random() * 3)];
        this.note(midiToHz(bassRoot), t, beat_s * 3.5, 'triangle', 0.22, -0.15);
      }

      // ── Chords every 2 beats ───────────────────────────────────────────────
      if (beat % 8 === 0 || beat % 8 === 4) {
        const chord = [scale[0], scale[2], scale[4]].map(s => root - 12 + s);
        chord.forEach((n, i) => {
          const pan = (i - 1) * 0.35;
          this.note(midiToHz(n), t + 0.01 * i, beat_s * 3.8, 'sine', 0.065, pan);
        });
      }

      // ── Melody ─────────────────────────────────────────────────────────────
      const patt = [0, null, 2, null, 1, 3, null, 2, 4, null, 3, null, 5, null, 4, 6,
                    2, null, 4, null, 3, 5, null, 4, 6, null, 5, null, 7, null, 6, null];
      const ni = patt[beat % patt.length];
      if (ni !== null) {
        const oct = beat >= 16 ? 12 : 0;
        const n   = root + scale[ni % scale.length] + oct;
        const pan = (Math.random() - 0.5) * 0.5;
        this.note(midiToHz(n), t + beat_s * 0.04, beat_s * 0.8, 'sine', 0.13, pan);
      }

      // ── Soft hi-hat ────────────────────────────────────────────────────────
      if (beat % 2 === 0) {
        const noise = this.ctx.createOscillator();
        const g     = this.ctx.createGain();
        const f     = this.ctx.createBiquadFilter();
        noise.type = 'square'; noise.frequency.value = 6000;
        f.type = 'highpass'; f.frequency.value = 5000;
        g.gain.setValueAtTime(0.025, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
        noise.connect(f); f.connect(g); g.connect(this.dryGain);
        noise.start(t); noise.stop(t + 0.05);
      }

      // ── Kick ───────────────────────────────────────────────────────────────
      if (beat % 4 === 0) {
        const kick = this.ctx.createOscillator();
        const g    = this.ctx.createGain();
        kick.type  = 'sine';
        kick.frequency.setValueAtTime(120, t);
        kick.frequency.exponentialRampToValueAtTime(40, t + 0.12);
        g.gain.setValueAtTime(0.28, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
        kick.connect(g); g.connect(this.dryGain);
        kick.start(t); kick.stop(t + 0.3);
      }

      // ── Snare (brushed feel) ───────────────────────────────────────────────
      if (beat % 4 === 2) {
        const s = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        s.type  = 'sawtooth'; s.frequency.value = 200;
        g.gain.setValueAtTime(0.08, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
        s.connect(g); g.connect(this.dryGain);
        s.start(t); s.stop(t + 0.14);
      }

      // ── Vinyl crackle ─────────────────────────────────────────────────────
      if (Math.random() < 0.05) {
        const c = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        c.type  = 'sawtooth'; c.frequency.value = 1800 + Math.random() * 4000;
        g.gain.setValueAtTime(0.008, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
        c.connect(g); g.connect(this.dryGain);
        c.start(t); c.stop(t + 0.035);
      }

      this.beatCount++;
      this.nextBeatTime += beat_s;
    }
  }

  play() {
    if (this.ctx.state === 'suspended') this.ctx.resume();
    this.isPlaying   = true;
    this.nextBeatTime = this.ctx.currentTime + 0.05;
    this.beatCount   = 0;
    this.timerID     = setInterval(() => this.scheduleBeats(), this.lookahead);
  }

  stop() {
    this.isPlaying = false;
    if (this.timerID) { clearInterval(this.timerID); this.timerID = null; }
  }

  switchTrack(idx: number) {
    const was = this.isPlaying;
    if (was) this.stop();
    this.currentTrackIdx = idx;
    this.beatCount = 0;
    if (was) setTimeout(() => this.play(), 80);
  }

  destroy() { this.stop(); this.ctx.close(); }
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function CatMusicPlayer() {
  const [playing, setPlaying] = useState(false);
  const [track,   setTrack]   = useState(0);
  const [vol,     setVol]     = useState(0.45);
  const [open,    setOpen]    = useState(false);
  const [started, setStarted] = useState(false);
  const engRef = useRef<CatAudioEngine | null>(null);

  const init = useCallback(() => {
    if (!engRef.current) engRef.current = new CatAudioEngine();
    return engRef.current;
  }, []);

  const togglePlay = useCallback(() => {
    const e = init();
    if (playing) { e.stop(); setPlaying(false); }
    else         { e.play(); setPlaying(true); setStarted(true); }
  }, [playing, init]);

  const selectTrack = useCallback((idx: number) => {
    const e = init();
    e.switchTrack(idx);
    setTrack(idx);
    if (!playing) { e.play(); setPlaying(true); setStarted(true); }
  }, [playing, init]);

  const changeVol = useCallback((v: number) => {
    setVol(v);
    engRef.current?.setVolume(v);
  }, []);

  useEffect(() => () => { engRef.current?.destroy(); }, []);

  return (
    <div className="fixed bottom-5 left-5 z-40 select-none no-click">
      {open && (
        <div
          className="absolute bottom-14 left-0 rounded-xl border border-white/10 overflow-hidden shadow-2xl mb-1"
          style={{ background: 'linear-gradient(160deg, #1e1b16 0%, #110f0c 100%)', minWidth: 210 }}
        >
          <div className="px-3 pt-3 pb-1">
            <p className="text-stone-500 text-[10px] tracking-widest uppercase font-semibold mb-2">Tracks</p>
            {TRACKS.map(tr => (
              <button
                key={tr.id}
                onClick={() => selectTrack(tr.id)}
                className={`w-full text-left px-2 py-2 rounded-lg mb-0.5 flex items-center gap-2 text-sm transition-all
                  ${track === tr.id
                    ? 'bg-amber-400/15 text-amber-300'
                    : 'text-stone-400 hover:text-white hover:bg-white/5'}`}
              >
                <span className="text-base leading-none">
                  {track === tr.id && playing ? '▶' : '♩'}
                </span>
                <span className="font-medium tracking-wide">{tr.name}</span>
              </button>
            ))}
          </div>
          <div className="px-4 py-3 border-t border-white/[0.06]">
            <p className="text-stone-500 text-[10px] tracking-widest uppercase font-semibold mb-2">Volume</p>
            <input
              type="range" min={0} max={1} step={0.01} value={vol}
              onChange={e => changeVol(parseFloat(e.target.value))}
              className="w-full accent-amber-400"
            />
          </div>
        </div>
      )}

      <div
        className="flex items-center gap-2 rounded-full border border-white/10 px-3 py-2 shadow-xl"
        style={{ background: 'linear-gradient(135deg, #1e1b16 0%, #110f0c 100%)' }}
      >
        <button
          onClick={togglePlay}
          className="w-8 h-8 rounded-full flex items-center justify-center bg-amber-400/10 hover:bg-amber-400/20 text-amber-400 transition-all text-sm"
          title={playing ? 'Pause' : 'Play cat music'}
        >
          {playing ? '⏸' : '▶'}
        </button>
        <button
          onClick={() => setOpen(o => !o)}
          className="flex items-center gap-1.5 text-xs text-stone-400 hover:text-stone-200 transition-colors pr-1"
        >
          <span className={playing ? 'text-amber-400' : ''}>♪</span>
          <span className="font-medium tracking-wide max-w-[120px] truncate">
            {started ? TRACKS[track].name : 'Cat Music'}
          </span>
          <span className="text-stone-600 text-[10px]">{open ? '▲' : '▼'}</span>
        </button>
      </div>
    </div>
  );
}
