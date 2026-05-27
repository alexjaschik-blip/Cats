'use client';

import { useState, useRef, useCallback } from 'react';
import Image from 'next/image';

const HOODS = [
  'Exarcheia', 'Monastiraki', 'Plaka', 'Kolonaki', 'Psiri', 'Gazi',
  'Pangrati', 'Kypseli', 'Petralona', 'Thisio', 'Koukaki', 'Keramikos',
  'Neos Kosmos', 'Piraeus', 'Glyfada', 'Kifisia', 'Kesariani', 'Vyronas',
  'Zografou', 'Nea Smyrni', 'Kallithea', 'Moschato', 'Ilioupoli', 'Dafni',
  'Peristeri', 'Chalandri', 'Marousi', 'Holargos',
];

type Cat = {
  id: number;
  image: string;
  name: string;
  neighborhood: string;
  quote: string;
  uploaded_by: string | null;
};

type RandomState = 'idle' | 'loading' | 'done';

export default function UploadModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: (cat: Cat) => void;
}) {
  const [preview, setPreview]       = useState<string | null>(null);
  const [file, setFile]             = useState<File | null>(null);
  const [catName, setCatName]       = useState('');
  const [catQuote, setCatQuote]     = useState('');
  const [hood, setHood]             = useState('');
  const [uploaderName, setUploaderName] = useState('');
  const [error, setError]           = useState('');
  const [uploading, setUploading]   = useState(false);
  const [nameState, setNameState]   = useState<RandomState>('idle');
  const [quoteState, setQuoteState] = useState<RandomState>('idle');
  const inputRef = useRef<HTMLInputElement>(null);
  const isDragging = useRef(false);

  // ── Photo helpers ────────────────────────────────────────────────────────────
  const handleFile = (f: File) => {
    if (!f.type.startsWith('image/')) { setError('Must be an image file'); return; }
    if (f.size > 15 * 1024 * 1024)   { setError('File too large (max 15 MB)'); return; }
    setError('');
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    isDragging.current = false;
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  // ── Random pickers ───────────────────────────────────────────────────────────
  const pickRandom = useCallback(async (type: 'name' | 'quote') => {
    const setState = type === 'name' ? setNameState : setQuoteState;
    const setValue = type === 'name' ? setCatName   : setCatQuote;
    setState('loading');
    try {
      const res  = await fetch(`/api/random?type=${type}`);
      const data = await res.json() as { name?: string | null; quote?: string | null };
      const val  = type === 'name' ? data.name : data.quote;
      if (val) setValue(val);
      setState('done');
      setTimeout(() => setState('idle'), 600);
    } catch {
      setState('idle');
    }
  }, []);

  // ── Submit ───────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!file) { setError('Please choose a photo first'); return; }
    setUploading(true);
    setError('');
    try {
      const form = new FormData();
      form.append('image',        file);
      form.append('catName',      catName.trim());
      form.append('catQuote',     catQuote.trim());
      form.append('neighborhood', hood);
      form.append('uploaderName', uploaderName.trim());

      const res  = await fetch('/api/upload', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Upload failed'); return; }
      onSuccess(data.cat);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md no-click"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl mx-4 rounded-2xl border border-white/10 shadow-2xl overflow-hidden"
        style={{ background: 'linear-gradient(160deg, #1e1b16 0%, #110f0c 100%)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="px-6 pt-5 pb-4 border-b border-white/[0.06]">
          <h2 className="text-white font-black text-xl tracking-tight" style={{ fontFamily: 'Georgia, serif' }}>
            Upload Cat
          </h2>
          <p className="text-stone-500 text-xs mt-1 tracking-wide">
            Must be a cat spotted in Athens. Joins the archive immediately.
          </p>
        </div>

        {/* ── Two-column body ── */}
        <div className="flex gap-0 p-6">

          {/* LEFT — drop zone */}
          <div className="flex-shrink-0 w-52 flex flex-col gap-3">
            <div
              className={`relative rounded-xl overflow-hidden border-2 border-dashed cursor-pointer transition-all group
                ${preview ? 'border-amber-400/30' : 'border-white/10 hover:border-amber-400/30'}`}
              style={{ height: 220 }}
              onClick={() => inputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={e => e.preventDefault()}
            >
              {preview ? (
                <Image src={preview} alt="preview" fill className="object-cover" unoptimized />
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-stone-600 gap-2 group-hover:text-stone-500 transition-colors px-3 text-center">
                  <span className="text-3xl">📸</span>
                  <span className="text-xs leading-relaxed tracking-wide">
                    Drop a photo<br />or click to browse
                  </span>
                  <span className="text-[10px] text-stone-700">JPG · PNG · WEBP<br />max 15 MB</span>
                </div>
              )}
              {preview && (
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                  <span className="text-white text-xs font-bold tracking-wider">Change</span>
                </div>
              )}
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
            </div>

            {/* Uploader credit */}
            <div>
              <label className="text-stone-500 text-[10px] tracking-widest uppercase font-semibold block mb-1">
                Photo by
              </label>
              <input
                type="text"
                value={uploaderName}
                onChange={e => setUploaderName(e.target.value)}
                placeholder="Your name (optional)"
                className="w-full bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 text-white text-xs placeholder:text-stone-600 focus:outline-none focus:border-amber-400/30 transition-colors"
              />
            </div>
          </div>

          {/* divider */}
          <div className="w-px bg-white/[0.06] mx-5 flex-shrink-0" />

          {/* RIGHT — fields */}
          <div className="flex-1 flex flex-col gap-4">

            {/* Cat Name */}
            <div>
              <label className="text-stone-400 text-[10px] tracking-widest uppercase font-semibold block mb-1.5">
                Cat Name
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={catName}
                  onChange={e => setCatName(e.target.value)}
                  placeholder="e.g. Baklava, Zorba, Mr. Fluffins…"
                  className="flex-1 min-w-0 bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-stone-600 focus:outline-none focus:border-amber-400/30 transition-colors"
                />
                <RandomButton
                  state={nameState}
                  onClick={() => pickRandom('name')}
                />
              </div>
              <p className="text-stone-600 text-[10px] mt-1.5 tracking-wide">
                Leave blank and Random will pull one from the archive — never repeated.
              </p>
            </div>

            {/* Neighborhood */}
            <div>
              <label className="text-stone-400 text-[10px] tracking-widest uppercase font-semibold block mb-1.5">
                Neighborhood
              </label>
              <select
                value={hood}
                onChange={e => setHood(e.target.value)}
                className="w-full bg-stone-900 border border-white/10 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-amber-400/30 transition-colors appearance-none"
                style={{ color: hood ? '#fff' : '#57534e' }}
              >
                <option value="" style={{ color: '#57534e' }}>Where was this cat spotted?</option>
                {HOODS.map(h => <option key={h} value={h} style={{ color: '#fff' }}>{h}</option>)}
              </select>
              <p className="text-stone-600 text-[10px] mt-1.5 tracking-wide">
                Leave blank and we&apos;ll guess the neighborhood.
              </p>
            </div>

            {/* Quote */}
            <div>
              <label className="text-stone-400 text-[10px] tracking-widest uppercase font-semibold block mb-1.5">
                Quote
              </label>
              <div className="flex gap-2 items-start">
                <textarea
                  value={catQuote}
                  onChange={e => setCatQuote(e.target.value)}
                  placeholder="Something this cat would say…"
                  rows={3}
                  className="flex-1 min-w-0 bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-stone-600 focus:outline-none focus:border-amber-400/30 transition-colors resize-none leading-relaxed"
                />
                <RandomButton
                  state={quoteState}
                  onClick={() => pickRandom('quote')}
                />
              </div>
              <p className="text-stone-600 text-[10px] mt-1.5 tracking-wide">
                Or hit Random — each quote used exactly once across the entire archive.
              </p>
            </div>

          </div>
        </div>

        {/* ── Footer ── */}
        <div className="px-6 pb-5 flex flex-col gap-3">
          {error && (
            <p className="text-red-400 text-xs tracking-wide">{error}</p>
          )}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-white/10 text-stone-400 hover:text-white text-sm font-semibold tracking-wide transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!file || uploading}
              className="flex-[2] py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:bg-stone-800 disabled:text-stone-600 text-black disabled:cursor-not-allowed text-sm font-black tracking-wide transition-all"
            >
              {uploading ? 'Uploading…' : 'Upload Cat'}
            </button>
          </div>
        </div>

        {/* ── Close ── */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 text-stone-500 hover:text-white flex items-center justify-center text-xs transition-all"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

// ── Random Button ─────────────────────────────────────────────────────────────
function RandomButton({ state, onClick }: { state: RandomState; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={state === 'loading'}
      className={`flex-shrink-0 px-3 py-2.5 rounded-lg text-xs font-black tracking-widest uppercase border transition-all whitespace-nowrap
        ${state === 'done'
          ? 'bg-amber-400/20 border-amber-400/50 text-amber-300'
          : state === 'loading'
          ? 'bg-white/5 border-white/10 text-stone-600 cursor-wait'
          : 'bg-white/5 border-white/10 text-stone-400 hover:bg-amber-400/10 hover:border-amber-400/30 hover:text-amber-300'
        }`}
    >
      {state === 'loading' ? '…' : state === 'done' ? '✓' : 'Random'}
    </button>
  );
}
