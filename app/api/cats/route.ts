import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

// GET /api/cats — returns count and a random cat
export function GET() {
  const db = getDb();
  const count = (db.prepare('SELECT COUNT(*) as c FROM cats WHERE approved = 1').get() as { c: number }).c;
  const random = db.prepare('SELECT * FROM cats WHERE approved = 1 ORDER BY RANDOM() LIMIT 1').get();
  return NextResponse.json({ count, cat: random });
}
