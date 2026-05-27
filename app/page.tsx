'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import Image from 'next/image';
import UploadModal from '@/components/UploadModal';
import CatMusicPlayer, { useCatMeow } from '@/components/CatMusicPlayer';

type Cat = {
  id: number;
  image: string;
  name: string;
  neighborhood: string;
  quote: string;
  uploaded_by: string | null;
};

type ClickedCat = Cat & { x: number; y: number; key: number };

const CARD_W = 320;
const CARD_H = 420;

export default function Home() {
  const [count, setCount] = useState<number>(99);
  const [catOfDay, setCatOfDay] = useState<Cat | null>(null);
  const [showCatOfDay, setShowCatOfDay] = useState(false);
  const [cards, setCards] = useState<ClickedCat[]>([]);
  const [showUpload, setShowUpload] = useState(false);
  const [loading, setLoading] = useState(false);
  const keyRef = useRef(0);
  const meow = useCatMeow();

  useEffect(() => {
    fetch('/api/cats').then(r => r.json()).then(d => setCount(d.count));
    fetch('/api/cat-of-day').then(r => r.json()).then(d => setCatOfDay(d.cat));
  }, []);

  const handleClick = useCallback(async (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('.no-click')) return;
    if (loading) return;
    meow();

    const x = Math.min(Math.max(e.clientX, CARD_W / 2 + 12), window.innerWidth - CARD_W / 2 - 12);
    const y = Math.min(Math.max(e.clientY, CARD_H / 2 + 12), window.innerHeight - CARD_H / 2 - 12);

    setLoading(true);
    try {
      const res = await fetch('/api/cats');
      const data = await res.json();
      if (data.cat) {
        const key = ++keyRef.current;
        setCards(prev => [...prev.slice(-4), { ...data.cat, x, y, key }]);
      }
    } finally {
      setLoading(false);
    }
  }, [loading]);

  const handleUploadSuccess = (newCat: Cat) => {
    setCount(c => c + 1);
    setShowUpload(false);
    const key = ++keyRef.current;
    setCards(prev => [
      ...prev.slice(-4),
      { ...newCat, x: window.innerWidth / 2, y: window.innerHeight / 2, key },
    ]);
  };

  return (
    <main
      className="relative w-screen h-screen overflow-hidden bg-stone-950 select-none cursor-crosshair"
      onClick={handleClick}
    >
      {/* Subtle grain texture */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E")`,
          backgroundSize: '200px 200px',
        }}
      />

      {/* Header */}
      <header className="absolute top-0 left-0 right-0 flex items-center justify-between px-6 pt-5 pb-3 z-20 pointer-events-none">
        <div>
          <h1 className="text-white font-black tracking-tight leading-none" style={{ fontSize: 'clamp(1.5rem, 3vw, 2.4rem)', fontFamily: 'Georgia, serif' }}>
            <span className="text-amber-400">{count}</span>
            <span className="text-stone-200"> Cats of Athens</span>
          </h1>
          <p className="text-stone-600 text-xs mt-1.5 tracking-widest uppercase font-medium">
            Click anywhere · A cat appears
          </p>
        </div>
        <div className="flex gap-2 pointer-events-auto no-click">
          <button
            onClick={() => setShowCatOfDay(true)}
            className="flex items-center gap-1.5 bg-amber-400/10 hover:bg-amber-400/20 border border-amber-400/25 text-amber-300 text-xs font-bold tracking-wider uppercase px-4 py-2 rounded-full transition-all duration-200"
          >
            ☀ Cat of the Day
          </button>
          <button
            onClick={() => setShowUpload(true)}
            className="flex items-center gap-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-stone-400 hover:text-stone-200 text-xs font-bold tracking-wider uppercase px-4 py-2 rounded-full transition-all duration-200"
          >
            + Upload Cat
          </button>
        </div>
      </header>

      {/* Empty state hint */}
      {cards.length === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10">
          <div className="text-7xl mb-5" style={{ animation: 'float 3s ease-in-out infinite' }}>🐱</div>
          <p className="text-stone-500 text-base tracking-[0.3em] uppercase font-light">Tap anywhere</p>
          <p className="text-stone-700 text-sm mt-2 tracking-wider">A cat of Athens awaits</p>
        </div>
      )}

      {/* Cat cards */}
      {cards.map((cat) => (
        <CatCard
          key={cat.key}
          cat={cat}
          onClose={() => setCards(prev => prev.filter(c => c.key !== cat.key))}
        />
      ))}

      {/* Cat of the Day overlay */}
      {showCatOfDay && catOfDay && (
        <div
          className="absolute inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md no-click"
          onClick={() => setShowCatOfDay(false)}
        >
          <div onClick={e => e.stopPropagation()} className="relative">
            <div className="absolute -top-5 left-1/2 -translate-x-1/2 z-10">
              <span className="bg-amber-400 text-black text-xs font-black tracking-widest uppercase px-5 py-1.5 rounded-full whitespace-nowrap shadow-lg">
                ☀ Cat of the Day
              </span>
            </div>
            <CatCard
              cat={{ ...catOfDay, x: 0, y: 0, key: -1 }}
              onClose={() => setShowCatOfDay(false)}
              isStatic
            />
          </div>
        </div>
      )}

      {/* Upload modal */}
      {showUpload && (
        <UploadModal
          onClose={() => setShowUpload(false)}
          onSuccess={handleUploadSuccess}
        />
      )}

      {/* Music player */}
      <CatMusicPlayer />

      {/* Loading indicator */}
      {loading && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-1.5 z-30 pointer-events-none">
          {[0, 1, 2].map(i => (
            <div
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-amber-400"
              style={{ animation: `bounce 0.6s ease-in-out ${i * 0.15}s infinite alternate` }}
            />
          ))}
        </div>
      )}

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-12px); }
        }
        @keyframes bounce {
          from { transform: translateY(0); }
          to { transform: translateY(-8px); }
        }
      `}</style>
    </main>
  );
}

// ─── Cat Card ─────────────────────────────────────────────────────────────────

function CatCard({
  cat,
  onClose,
  isStatic = false,
}: {
  cat: ClickedCat;
  onClose: () => void;
  isStatic?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  const [imgErr, setImgErr] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 10);
    return () => clearTimeout(t);
  }, []);

  const posStyle: React.CSSProperties = isStatic
    ? { position: 'relative' }
    : {
        position: 'absolute',
        left: cat.x,
        top: cat.y,
        zIndex: 30,
        transform: `translate(-50%, -50%) scale(${visible ? 1 : 0.7})`,
        transition: 'opacity 0.3s ease, transform 0.35s cubic-bezier(0.34,1.56,0.64,1)',
        opacity: visible ? 1 : 0,
      };

  return (
    <div className="no-click" style={posStyle}>
      <div
        className="relative rounded-2xl overflow-hidden shadow-2xl border border-white/[0.07]"
        style={{
          width: CARD_W,
          background: 'linear-gradient(160deg, #1e1b16 0%, #0d0b09 100%)',
        }}
      >
        {/* Photo */}
        <div className="relative w-full" style={{ height: 260 }}>
          {!imgErr ? (
            <Image
              src={`/cats/${cat.image}`}
              alt={cat.name}
              fill
              className="object-cover"
              onError={() => setImgErr(true)}
              unoptimized
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-stone-800 text-6xl">🐱</div>
          )}
          {/* bottom fade */}
          <div
            className="absolute inset-0"
            style={{ background: 'linear-gradient(to top, rgba(13,11,9,0.92) 0%, rgba(13,11,9,0.2) 50%, transparent 100%)' }}
          />
          {/* Name + hood */}
          <div className="absolute bottom-3 left-4 right-8">
            <p
              className="text-white font-black text-xl leading-tight drop-shadow-lg"
              style={{ fontFamily: 'Georgia, serif' }}
            >
              {cat.name}
            </p>
            <p className="text-amber-400 text-xs tracking-[0.2em] uppercase font-bold mt-0.5">
              {cat.neighborhood}
            </p>
          </div>
        </div>

        {/* Quote */}
        <div className="px-4 py-4">
          <p
            className="text-stone-400 text-sm leading-relaxed italic"
            style={{ fontFamily: 'Georgia, serif' }}
          >
            &ldquo;{cat.quote}&rdquo;
          </p>
          {cat.uploaded_by && (
            <p className="text-stone-600 text-xs mt-2 tracking-wider">Photo by {cat.uploaded_by}</p>
          )}
        </div>

        {/* Close btn */}
        <button
          onClick={onClose}
          className="absolute top-2.5 right-2.5 w-7 h-7 rounded-full bg-black/60 hover:bg-black/90 text-white/50 hover:text-white flex items-center justify-center text-xs transition-all"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
