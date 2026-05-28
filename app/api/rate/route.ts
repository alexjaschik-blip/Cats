import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

type RatingStats = { avg: number | null; count: number };

function getStats(catId: number): { avgStars: number | null; voteCount: number } {
  const db   = getDb();
  const row  = db.prepare(
    'SELECT AVG(stars) as avg, COUNT(*) as count FROM cat_ratings WHERE cat_id = ?'
  ).get(catId) as RatingStats;
  return {
    avgStars:  row.avg !== null ? Math.round(row.avg * 10) / 10 : null,
    voteCount: row.count,
  };
}

/** GET /api/rate?catId=123  →  { avgStars, voteCount } */
export async function GET(req: NextRequest) {
  const catId = parseInt(req.nextUrl.searchParams.get('catId') ?? '');
  if (!catId) return NextResponse.json({ error: 'Missing catId' }, { status: 400 });
  return NextResponse.json(getStats(catId));
}

/** POST /api/rate  body: { catId, stars }  →  { avgStars, voteCount } */
export async function POST(req: NextRequest) {
  let body: { catId?: number; stars?: number };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Bad JSON' }, { status: 400 }); }

  const { catId, stars } = body;
  if (!catId || !stars || stars < 1 || stars > 5) {
    return NextResponse.json({ error: 'catId and stars (1–5) required' }, { status: 400 });
  }

  const db = getDb();
  db.prepare('INSERT INTO cat_ratings (cat_id, stars) VALUES (?, ?)').run(catId, stars);
  return NextResponse.json(getStats(catId));
}
