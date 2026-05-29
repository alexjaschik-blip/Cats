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

type LeaderboardCat = {
  id: number;
  image: string;
  name: string;
  neighborhood: string;
  avg_stars: number;
  vote_count: number;
};

const CARD_W = 320;
const CARD_H = 460; // a bit taller now to fit stars

export default function Home() {
  const [count,          setCount]          = useState<number>(99);
  const [catOfDay,       setCatOfDay]       = useState<Cat | null>(null);
  const [showCatOfDay,   setShowCatOfDay]   = useState(false);
  const [showLeaderboard,setShowLeaderboard]= useState(false);
  const [cards,          setCards]          = useState<ClickedCat[]>([]);
  const [showUpload,     setShowUpload]     = useState(false);
  const [loading,        setLoading]        = useState(false);
  const keyRef = useRef(0);
  const meow   = useCatMeow();

  useEffect(() => {
    fetch('/api/cats').then(r => r.json()).then(d => setCount(d.count));
    fetch('/api/cat-of-day').then(r => r.json()).then(d => setCatOfDay(d.cat));
  }, []);

  const handleClick = useCallback(async (e: React.MouseEvent<HTMLDivElement>) => {
    // Only block clicks from explicitly no-click UI chrome (buttons, modals, player)
    // Cat cards are intentionally NOT no-click so tapping a card spawns another cat
    if ((e.target as HTMLElement).closest('.no-click')) return;
    if (loading) return;
    meow();

    const x = Math.min(Math.max(e.clientX, CARD_W / 2 + 12), window.innerWidth  - CARD_W / 2 - 12);
    const y = Math.min(Math.max(e.clientY, CARD_H / 2 + 12), window.innerHeight - CARD_H / 2 - 12);

    setLoading(true);
    try {
      const res  = await fetch('/api/cats');
      const data = await res.json();
      if (data.cat) {
        const key = ++keyRef.current;
        setCards(prev => [...prev.slice(-4), { ...data.cat, x, y, key }]);
      }
    } finally {
      setLoading(false);
    }
  }, [loading, meow]);

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
        <div className="flex gap-2 pointer-events-auto no-click flex-wrap justify-end">
          <button
            onClick={() => setShowLeaderboard(true)}
            className="flex items-center gap-1.5 bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/25 text-yellow-300 text-xs font-bold tracking-wider uppercase px-4 py-2 rounded-full transition-all duration-200"
          >
            🏆 Highscore
          </button>
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

      {/* Cat cards — no no-click wrapper so tapping a card also spawns a new one */}
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

      {/* Leaderboard overlay */}
      {showLeaderboard && (
        <LeaderboardModal onClose={() => setShowLeaderboard(false)} />
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

      {/* Credits – CC BY 4.0 attribution required for meow sounds */}
      <div className="fixed bottom-4 right-4 z-10 pointer-events-none text-right no-click">
        <p className="text-stone-700 text-[9px] tracking-wide leading-snug">
          Cat sounds:{' '}
          <a href="https://freesound.org/people/redjamie7/packs/40688/" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-stone-500 transition-colors pointer-events-auto">redjamie7</a>
          {' '}·{' '}
          <a href="https://freesound.org/people/lukey1028/" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-stone-500 transition-colors pointer-events-auto">lukey1028</a>
          {' '}·{' '}
          <a href="https://freesound.org/people/timtube/" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-stone-500 transition-colors pointer-events-auto">timtube</a>
          {' '}·{' '}
          <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-stone-500 transition-colors pointer-events-auto">CC BY 4.0</a>
        </p>
      </div>

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
          50%       { transform: translateY(-12px); }
        }
        @keyframes bounce {
          from { transform: translateY(0); }
          to   { transform: translateY(-8px); }
        }
      `}</style>
    </main>
  );
}

// ─── Star Rating ──────────────────────────────────────────────────────────────

function StarRating({ catId }: { catId: number }) {
  const key = `cat_rated_${catId}`;
  const [myRating, setMyRating] = useState<number | null>(null);
  const [hovered,  setHovered]  = useState(0);
  const [avg,      setAvg]      = useState<number | null>(null);
  const [count,    setCount]    = useState<number | null>(null);
  const [busy,     setBusy]     = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(key);
    if (stored) setMyRating(parseInt(stored, 10));

    fetch(`/api/rate?catId=${catId}`)
      .then(r => r.json())
      .then(d => { setAvg(d.avgStars); setCount(d.voteCount); })
      .catch(() => {});
  }, [catId, key]);

  const handleRate = async (stars: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (myRating !== null || busy) return;
    setBusy(true);
    try {
      const res  = await fetch('/api/rate', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ catId, stars }),
      });
      const data = await res.json();
      setMyRating(stars);
      setAvg(data.avgStars);
      setCount(data.voteCount);
      localStorage.setItem(key, String(stars));
    } finally {
      setBusy(false);
    }
  };

  const display = myRating ?? hovered;
  const alreadyRated = myRating !== null;

  return (
    <div className="mt-2 flex flex-col gap-1">
      <div
        className="flex gap-0.5"
        onMouseLeave={() => { if (!alreadyRated) setHovered(0); }}
      >
        {[1, 2, 3, 4, 5].map(s => (
          <button
            key={s}
            disabled={alreadyRated || busy}
            onMouseEnter={e => { e.stopPropagation(); if (!alreadyRated) setHovered(s); }}
            onClick={e => handleRate(s, e)}
            className={`text-xl leading-none transition-all select-none
              ${s <= display
                ? 'text-amber-400'
                : 'text-stone-700'}
              ${!alreadyRated
                ? 'cursor-pointer hover:scale-125 active:scale-110'
                : 'cursor-default'}`}
          >
            ★
          </button>
        ))}
      </div>
      <p className="text-stone-600 text-[10px] tracking-wide h-3">
        {alreadyRated && !count && 'Thanks for voting!'}
        {count !== null && count > 0
          ? `${avg?.toFixed(1)} avg · ${count} vote${count !== 1 ? 's' : ''}`
          : !alreadyRated
            ? 'Rate this cat'
            : 'Thanks for voting!'}
      </p>
    </div>
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
  const [imgErr,  setImgErr]  = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 10);
    return () => clearTimeout(t);
  }, []);

  const posStyle: React.CSSProperties = isStatic
    ? { position: 'relative' }
    : {
        position:   'absolute',
        left:       cat.x,
        top:        cat.y,
        zIndex:     30,
        transform:  `translate(-50%, -50%) scale(${visible ? 1 : 0.7})`,
        transition: 'opacity 0.3s ease, transform 0.35s cubic-bezier(0.34,1.56,0.64,1)',
        opacity:    visible ? 1 : 0,
      };

  return (
    // No no-click here — clicking the card body bubbles up and spawns a new cat
    <div style={posStyle}>
      <div
        className="relative rounded-2xl overflow-hidden shadow-2xl border border-white/[0.07]"
        style={{
          width:      CARD_W,
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

        {/* Quote + stars */}
        <div className="px-4 pt-3 pb-4">
          <p
            className="text-stone-400 text-sm leading-relaxed italic"
            style={{ fontFamily: 'Georgia, serif' }}
          >
            &ldquo;{cat.quote}&rdquo;
          </p>
          {cat.uploaded_by && (
            <p className="text-stone-600 text-xs mt-1.5 tracking-wider">Photo by {cat.uploaded_by}</p>
          )}
          {/* Stars — stopPropagation is handled inside StarRating */}
          <StarRating catId={cat.id} />
        </div>

        {/* Close btn — must stopPropagation so it doesn't spawn a new cat */}
        <button
          onClick={e => { e.stopPropagation(); onClose(); }}
          className="absolute top-2.5 right-2.5 w-7 h-7 rounded-full bg-black/60 hover:bg-black/90 text-white/50 hover:text-white flex items-center justify-center text-xs transition-all"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

// ─── Leaderboard Modal ────────────────────────────────────────────────────────

function LeaderboardModal({ onClose }: { onClose: () => void }) {
  const [cats,    setCats]    = useState<LeaderboardCat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/leaderboard')
      .then(r => r.json())
      .then(d => { setCats(d.cats ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const medal = (i: number) => {
    if (i === 0) return '🥇';
    if (i === 1) return '🥈';
    if (i === 2) return '🥉';
    return `#${i + 1}`;
  };

  const starBar = (avg: number) => {
    const full    = Math.round(avg);
    const filled  = '★'.repeat(full);
    const empty   = '☆'.repeat(5 - full);
    return filled + empty;
  };

  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md no-click"
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="relative rounded-2xl border border-white/10 overflow-hidden shadow-2xl w-full max-w-sm mx-4 flex flex-col"
        style={{
          background: 'linear-gradient(160deg, #1e1b16 0%, #0d0b09 100%)',
          maxHeight: '82vh',
        }}
      >
        {/* Sticky header */}
        <div
          className="flex items-center justify-between px-5 py-4 border-b border-white/[0.07] flex-shrink-0"
          style={{ background: 'linear-gradient(160deg, #1e1b16 0%, #0d0b09 100%)' }}
        >
          <div>
            <h2
              className="text-white font-black text-xl leading-tight"
              style={{ fontFamily: 'Georgia, serif' }}
            >
              🏆 Hall of Fame
            </h2>
            <p className="text-stone-500 text-[10px] tracking-widest uppercase mt-0.5">
              Athens&apos; top-rated cats
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-black/60 hover:bg-black/90 text-white/50 hover:text-white flex items-center justify-center text-xs transition-all"
          >
            ✕
          </button>
        </div>

        {/* Scrollable list */}
        <div className="overflow-y-auto p-3 flex-1">
          {loading && (
            <p className="text-stone-500 text-sm text-center py-10">Loading…</p>
          )}
          {!loading && cats.length === 0 && (
            <div className="text-center py-10 px-4">
              <p className="text-4xl mb-3">🐱</p>
              <p className="text-stone-400 text-sm font-medium">No ratings yet</p>
              <p className="text-stone-600 text-xs mt-1">Click a cat and give it stars to start the ranking!</p>
            </div>
          )}
          {cats.map((cat, i) => (
            <div
              key={cat.id}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl mb-1 hover:bg-white/[0.04] transition-colors"
            >
              {/* Rank */}
              <span
                className={`text-sm font-black w-7 text-center flex-shrink-0 ${
                  i === 0 ? 'text-yellow-400' : i === 1 ? 'text-stone-300' : i === 2 ? 'text-amber-700' : 'text-stone-600'
                }`}
              >
                {medal(i)}
              </span>

              {/* Photo */}
              <div className="w-11 h-11 rounded-lg overflow-hidden flex-shrink-0 bg-stone-800">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/cats/${cat.image}`}
                  alt={cat.name}
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Name + hood */}
              <div className="flex-1 min-w-0">
                <p
                  className="text-white text-sm font-bold truncate leading-tight"
                  style={{ fontFamily: 'Georgia, serif' }}
                >
                  {cat.name}
                </p>
                <p className="text-amber-400 text-[10px] tracking-wider uppercase truncate mt-0.5">
                  {cat.neighborhood}
                </p>
              </div>

              {/* Stars + count */}
              <div className="text-right flex-shrink-0">
                <p className="text-amber-400 text-sm leading-none">{starBar(cat.avg_stars)}</p>
                <p className="text-stone-500 text-[10px] mt-1">
                  {cat.avg_stars.toFixed(1)} · {cat.vote_count} vote{cat.vote_count !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
