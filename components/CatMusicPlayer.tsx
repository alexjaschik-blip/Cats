'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

// ─── Track definitions ────────────────────────────────────────────────────────
const TRACKS = [
  { id: 0, name: 'Plaka Midnight',     bpm: 72,  key: 57, mood: 'minor' as const },
  { id: 1, name: 'Roof of Exarcheia', bpm: 88,  key: 60, mood: 'minor' as const },
  { id: 2, name: 'Kolonaki Dusk',     bpm: 65,  key: 62, mood: 'major' as const },
  { id: 3, name: 'Monastiraki Jazz',  bpm: 100, key: 55, mood: 'dorian' as const },
];

type Mood = 'minor' | 'major' | 'dorian';

// Scale intervals in semitones from root
const SCALES: Record<Mood, number[]> = {
  minor:  [0, 2, 3, 5, 7, 8, 10, 12],
  major:  [0, 2, 4, 5, 7, 9, 11, 12],
  dorian: [0, 2, 3, 5, 7, 9, 10, 12],
};

function midiToHz(midi: number) { return 440 * Math.pow(2, (midi - 69) / 12); }

// ─── Audio engine ─────────────────────────────────────────────────────────────
class CatAudioEngine {
  ctx: AudioContext;
  masterGain: GainNode;
  reverb: ConvolverNode;
  reverbGain: GainNode;
  dryGain: GainNode;
  scheduledNodes: AudioNode[] = [];
  currentTrackIdx = 0;
  isPlaying = false;
  nextBeatTime = 0;
  scheduleAhead = 0.3;
  lookahead = 25; // ms
  timerID: ReturnType<typeof setInterval> | null = null;
  beatCount = 0;
  volume = 0.55;

  constructor() {
    this.ctx = new AudioContext();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.volume;
    this.masterGain.connect(this.ctx.destination);

    // Simple reverb via delay network
    this.reverb = this.ctx.createConvolver();
    this.buildReverb();

    this.reverbGain = this.ctx.createGain();
    this.reverbGain.gain.value = 0.25;

    this.dryGain = this.ctx.createGain();
    this.dryGain.gain.value = 0.75;

    this.reverb.connect(this.reverbGain);
    this.reverbGain.connect(this.masterGain);
    this.dryGain.connect(this.masterGain);
  }

  buildReverb() {
    const rate = this.ctx.sampleRate;
    const length = rate * 2.5;
    const impulse = this.ctx.createBuffer(2, length, rate);
    for (let ch = 0; ch < 2; ch++) {
      const data = impulse.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2.5);
      }
    }
    this.reverb.buffer = impulse;
  }

  setVolume(v: number) {
    this.volume = v;
    this.masterGain.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05);
  }

  // ── Oscillator helpers ──────────────────────────────────────────────────────
  playNote(freq: number, startTime: number, duration: number, type: OscillatorType, gainVal: number, pan = 0) {
    const osc   = this.ctx.createOscillator();
    const gain  = this.ctx.createGain();
    const panner = this.ctx.createStereoPanner();

    osc.type      = type;
    osc.frequency.value = freq;
    panner.pan.value = pan;

    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(gainVal, startTime + 0.01);
    gain.gain.setTargetAtTime(0, startTime + duration * 0.7, duration * 0.2);

    osc.connect(gain);
    gain.connect(panner);
    panner.connect(this.dryGain);
    panner.connect(this.reverb);

    osc.start(startTime);
    osc.stop(startTime + duration + 0.3);
    return osc;
  }

  playPerc(freq: number, startTime: number, duration: number, gainVal: number) {
    const noise = this.ctx.createOscillator();
    const gain  = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    noise.type = 'square';
    noise.frequency.value = freq;
    filter.type = 'bandpass';
    filter.frequency.value = freq * 4;
    filter.Q.value = 0.5;

    gain.gain.setValueAtTime(gainVal, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.dryGain);

    noise.start(startTime);
    noise.stop(startTime + duration);
  }

  // ── Beat scheduler ──────────────────────────────────────────────────────────
  scheduleBeats() {
    const track = TRACKS[this.currentTrackIdx];
    const beatLen = 60 / track.bpm;
    const scale   = SCALES[track.mood];
    const root    = track.key;

    while (this.nextBeatTime < this.ctx.currentTime + this.scheduleAhead) {
      const t    = this.nextBeatTime;
      const beat = this.beatCount % 16; // 4/4, 4 bars of 4

      // ── Bass ────────────────────────────────────────────────────────────────
      if (beat % 4 === 0) {
        const bassNote = root - 12 + scale[Math.floor(Math.random() * 3)];
        this.playNote(midiToHz(bassNote), t, beatLen * 1.8, 'sawtooth', 0.18, -0.1);
      }

      // ── Melody ──────────────────────────────────────────────────────────────
      const melodyPattern = [0, null, 2, null, 1, 3, null, 2, 4, null, 3, null, 5, null, 4, 6];
      const noteIdx = melodyPattern[beat];
      if (noteIdx !== null) {
        const note = root + scale[noteIdx % scale.length];
        const octave = beat > 7 ? 12 : 0;
        const pan = (Math.random() - 0.5) * 0.4;
        this.playNote(midiToHz(note + octave), t + beatLen * 0.05, beatLen * 0.85, 'sine', 0.14, pan);
      }

      // ── Harmony (sparse chords) ─────────────────────────────────────────────
      if (beat % 8 === 0) {
        const third = root + scale[2];
        const fifth = root + scale[4];
        this.playNote(midiToHz(third), t, beatLen * 3.5, 'sine', 0.07, 0.3);
        this.playNote(midiToHz(fifth), t, beatLen * 3.5, 'sine', 0.07, -0.3);
      }

      // ── Hi-hat ─────────────────────────────────────────────────────────────
      if (beat % 2 === 0) this.playPerc(8000, t, 0.04, 0.04);
      else if (beat % 4 === 2) this.playPerc(6000, t, 0.03, 0.025);

      // ── Kick / snare ────────────────────────────────────────────────────────
      if (beat % 4 === 0)                  this.playPerc(55, t, 0.18, 0.22);
      if (beat % 4 === 2)                  this.playPerc(180, t, 0.12, 0.15);
      if (beat % 8 === 6)                  this.playPerc(200, t + beatLen * 0.5, 0.1, 0.09);

      // ── Occasional "vinyl" crackle ──────────────────────────────────────────
      if (Math.random() < 0.06) {
        const scratch = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        scratch.type = 'sawtooth';
        scratch.frequency.value = 1200 + Math.random() * 3000;
        g.gain.setValueAtTime(0.01, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
        scratch.connect(g); g.connect(this.dryGain);
        scratch.start(t); scratch.stop(t + 0.04);
      }

      this.beatCount++;
      this.nextBeatTime += beatLen;
    }
  }

  play() {
    if (this.ctx.state === 'suspended') this.ctx.resume();
    this.isPlaying = true;
    this.nextBeatTime = this.ctx.currentTime + 0.05;
    this.beatCount = 0;
    this.timerID = setInterval(() => this.scheduleBeats(), this.lookahead);
  }

  stop() {
    this.isPlaying = false;
    if (this.timerID) { clearInterval(this.timerID); this.timerID = null; }
  }

  switchTrack(idx: number) {
    const wasPlaying = this.isPlaying;
    if (wasPlaying) this.stop();
    this.currentTrackIdx = idx;
    this.beatCount = 0;
    if (wasPlaying) {
      setTimeout(() => this.play(), 80);
    }
  }

  // ── Meow synthesis ───────────────────────────────────────────────────────────
  meow() {
    if (this.ctx.state === 'suspended') this.ctx.resume();
    const t   = this.ctx.currentTime;
    const pitch = 500 + Math.random() * 600; // 500–1100 Hz range, cat-like
    const dur  = 0.25 + Math.random() * 0.55;

    // Main tone: fm synthesis for vowel-like quality
    const carrier  = this.ctx.createOscillator();
    const mod      = this.ctx.createOscillator();
    const modGain  = this.ctx.createGain();
    const gain     = this.ctx.createGain();
    const filter   = this.ctx.createBiquadFilter();

    carrier.type = 'sine';
    mod.type     = 'sine';

    // Pitch glide: start higher, fall (mee-oww)
    carrier.frequency.setValueAtTime(pitch * 1.3, t);
    carrier.frequency.exponentialRampToValueAtTime(pitch * 0.7, t + dur * 0.6);
    carrier.frequency.exponentialRampToValueAtTime(pitch * 0.5, t + dur);

    // FM modulation (adds harmonics)
    mod.frequency.value = pitch * 0.5;
    modGain.gain.setValueAtTime(pitch * 0.8, t);
    modGain.gain.exponentialRampToValueAtTime(pitch * 0.1, t + dur);

    // Formant filter (mouth opening)
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(800, t);
    filter.frequency.linearRampToValueAtTime(1600, t + dur * 0.3);
    filter.frequency.linearRampToValueAtTime(400, t + dur);
    filter.Q.value = 3;

    // Volume envelope
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.28, t + 0.03);
    gain.gain.setTargetAtTime(0, t + dur * 0.6, dur * 0.2);

    mod.connect(modGain);
    modGain.connect(carrier.frequency);
    carrier.connect(filter);
    filter.connect(gain);
    gain.connect(this.reverb);
    gain.connect(this.dryGain);

    mod.start(t); mod.stop(t + dur + 0.3);
    carrier.start(t); carrier.stop(t + dur + 0.3);
  }

  destroy() {
    this.stop();
    this.ctx.close();
  }
}

// ─── Component ────────────────────────────────────────────────────────────────
let engineSingleton: CatAudioEngine | null = null;

export function useCatMeow() {
  return useCallback(() => {
    if (engineSingleton) engineSingleton.meow();
  }, []);
}

export default function CatMusicPlayer() {
  const [playing, setPlaying]     = useState(false);
  const [track, setTrack]         = useState(0);
  const [vol, setVol]             = useState(0.55);
  const [open, setOpen]           = useState(false);
  const [started, setStarted]     = useState(false);
  const engineRef = useRef<CatAudioEngine | null>(null);

  // Init engine lazily on first play
  const initEngine = useCallback(() => {
    if (!engineRef.current) {
      engineRef.current = new CatAudioEngine();
      engineSingleton = engineRef.current;
    }
    return engineRef.current;
  }, []);

  const togglePlay = useCallback(() => {
    const engine = initEngine();
    if (playing) {
      engine.stop();
      setPlaying(false);
    } else {
      engine.play();
      setPlaying(true);
      setStarted(true);
    }
  }, [playing, initEngine]);

  const selectTrack = useCallback((idx: number) => {
    const engine = initEngine();
    engine.switchTrack(idx);
    setTrack(idx);
    if (!playing) {
      engine.play();
      setPlaying(true);
      setStarted(true);
    }
  }, [playing, initEngine]);

  const changeVol = useCallback((v: number) => {
    setVol(v);
    engineRef.current?.setVolume(v);
  }, []);

  useEffect(() => {
    return () => { engineRef.current?.destroy(); engineSingleton = null; };
  }, []);

  return (
    <div className="fixed bottom-5 left-5 z-40 select-none no-click">
      {/* Track list popup */}
      {open && (
        <div
          className="absolute bottom-14 left-0 rounded-xl border border-white/10 overflow-hidden shadow-2xl mb-1"
          style={{ background: 'linear-gradient(160deg, #1e1b16 0%, #110f0c 100%)', minWidth: 200 }}
        >
          <div className="px-3 pt-3 pb-1">
            <p className="text-stone-500 text-[10px] tracking-widest uppercase font-semibold mb-2">Tracks</p>
            {TRACKS.map((tr) => (
              <button
                key={tr.id}
                onClick={() => selectTrack(tr.id)}
                className={`w-full text-left px-2 py-2 rounded-lg mb-0.5 flex items-center gap-2 text-sm transition-all
                  ${track === tr.id
                    ? 'bg-amber-400/15 text-amber-300'
                    : 'text-stone-400 hover:text-white hover:bg-white/5'
                  }`}
              >
                <span className="text-base leading-none">
                  {track === tr.id && playing ? '▶' : '♩'}
                </span>
                <span className="font-medium tracking-wide">{tr.name}</span>
              </button>
            ))}
          </div>
          {/* Volume */}
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

      {/* Main player bar */}
      <div
        className="flex items-center gap-2 rounded-full border border-white/10 px-3 py-2 shadow-xl"
        style={{ background: 'linear-gradient(135deg, #1e1b16 0%, #110f0c 100%)' }}
      >
        {/* Play/pause */}
        <button
          onClick={togglePlay}
          className="w-8 h-8 rounded-full flex items-center justify-center bg-amber-400/10 hover:bg-amber-400/20 text-amber-400 transition-all text-sm"
          title={playing ? 'Pause' : 'Play cat music'}
        >
          {playing ? '⏸' : '▶'}
        </button>

        {/* Track name */}
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
