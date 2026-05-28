import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

/** GET /api/leaderboard  →  { cats: LeaderboardCat[] } (top 10 by avg rating) */
export async function GET() {
  const db = getDb();
  const cats = db.prepare(`
    SELECT
      c.id,
      c.image,
      c.name,
      c.neighborhood,
      ROUND(AVG(r.stars), 1)  AS avg_stars,
      COUNT(r.id)             AS vote_count
    FROM cats c
    JOIN cat_ratings r ON c.id = r.cat_id
    WHERE c.approved = 1
    GROUP BY c.id
    ORDER BY avg_stars DESC, vote_count DESC
    LIMIT 10
  `).all();
  return NextResponse.json({ cats });
}
