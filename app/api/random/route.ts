import { NextRequest, NextResponse } from 'next/server';
import { getDb, getUsed } from '@/lib/db';
import { NAME_POOL, QUOTE_POOL } from '@/lib/cat-pool';

function pickUnused(pool: string[], used: Set<string>): string | null {
  const available = pool.filter(x => !used.has(x));
  if (available.length === 0) return null;
  return available[Math.floor(Math.random() * available.length)];
}

// GET /api/random?type=name|quote|both
export function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get('type') ?? 'both';
  const db = getDb();
  const { names, quotes } = getUsed(db);

  const result: { name?: string | null; quote?: string | null; namesLeft: number; quotesLeft: number } = {
    namesLeft:  NAME_POOL.filter(n => !names.has(n)).length,
    quotesLeft: QUOTE_POOL.filter(q => !quotes.has(q)).length,
  };

  if (type === 'name' || type === 'both') {
    result.name = pickUnused(NAME_POOL, names);
  }
  if (type === 'quote' || type === 'both') {
    result.quote = pickUnused(QUOTE_POOL, quotes);
  }

  return NextResponse.json(result);
}
