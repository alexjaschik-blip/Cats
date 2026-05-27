import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

// GET /api/cat-of-day — same cat all day, changes at midnight Athens time
export function GET() {
  const db = getDb();

  // Use Athens date as seed (UTC+3)
  const now = new Date();
  const athensOffset = 3 * 60; // minutes
  const localTime = new Date(now.getTime() + (athensOffset - now.getTimezoneOffset()) * 60000);
  const dateStr = localTime.toISOString().slice(0, 10); // "YYYY-MM-DD"

  // Deterministic pick: use date string to derive an index
  const count = (db.prepare('SELECT COUNT(*) as c FROM cats WHERE approved = 1').get() as { c: number }).c;
  if (count === 0) return NextResponse.json({ cat: null, date: dateStr });

  // Simple hash of dateStr → index
  let hash = 0;
  for (const ch of dateStr) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  const idx = hash % count;

  const cat = db.prepare(
    'SELECT * FROM cats WHERE approved = 1 LIMIT 1 OFFSET ?'
  ).get(idx);

  return NextResponse.json({ cat, date: dateStr });
}
