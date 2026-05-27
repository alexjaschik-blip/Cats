import { NextRequest, NextResponse } from 'next/server';
import { getDb, getUsed } from '@/lib/db';
import { NAME_POOL, QUOTE_POOL } from '@/lib/cat-pool';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic'];
const MAX_BYTES = 15 * 1024 * 1024;

const ATHENS_HOODS = [
  'Exarcheia', 'Monastiraki', 'Plaka', 'Kolonaki', 'Psiri', 'Gazi',
  'Pangrati', 'Kypseli', 'Petralona', 'Thisio', 'Koukaki', 'Keramikos',
  'Neos Kosmos', 'Piraeus', 'Glyfada', 'Kifisia', 'Kesariani', 'Vyronas',
  'Zografou', 'Nea Smyrni', 'Kallithea', 'Moschato', 'Ilioupoli', 'Dafni',
  'Peristeri', 'Chalandri', 'Marousi', 'Holargos',
];

function pickUnused(pool: string[], used: Set<string>): string | null {
  const available = pool.filter(x => !used.has(x));
  if (!available.length) return null;
  return available[Math.floor(Math.random() * available.length)];
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file         = form.get('image')        as File | null;
    const uploaderName = (form.get('uploaderName') as string | null)?.trim() || null;
    const neighborhood = (form.get('neighborhood') as string | null)?.trim() || '';
    const catName      = (form.get('catName')      as string | null)?.trim() || '';
    const catQuote     = (form.get('catQuote')     as string | null)?.trim() || '';

    if (!file)
      return NextResponse.json({ error: 'No image provided' }, { status: 400 });
    if (file.size > MAX_BYTES)
      return NextResponse.json({ error: 'Image too large (max 15 MB)' }, { status: 400 });
    if (!ALLOWED_TYPES.includes(file.type.toLowerCase()))
      return NextResponse.json({ error: 'Only JPG, PNG or WEBP allowed' }, { status: 400 });

    // ── Save file ──────────────────────────────────────────────────────────────
    const ext      = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const filename = `upload_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const uploadDir = path.join(process.cwd(), 'public', 'cats');
    await mkdir(uploadDir, { recursive: true });
    await writeFile(path.join(uploadDir, filename), Buffer.from(await file.arrayBuffer()));

    // ── Resolve name / quote / hood ────────────────────────────────────────────
    const db = getDb();
    const { names, quotes } = getUsed(db);

    // Visitor-typed values are allowed even if they match a pool entry (they bypass uniqueness).
    // Pool picks are guaranteed unique.
    const fromPoolName  = !catName;
    const fromPoolQuote = !catQuote;

    const finalName  = catName  || pickUnused(NAME_POOL,  names)  || 'The Nameless';
    const finalQuote = catQuote || pickUnused(QUOTE_POOL, quotes) || 'Athens has seen everything. Even me.';
    const finalHood  = ATHENS_HOODS.includes(neighborhood)
      ? neighborhood
      : ATHENS_HOODS[Math.floor(Math.random() * ATHENS_HOODS.length)];

    // ── Atomic insert + mark-used ─────────────────────────────────────────────
    const insertCat   = db.prepare('INSERT INTO cats (image, name, neighborhood, quote, uploaded_by) VALUES (?, ?, ?, ?, ?)');
    const markName    = db.prepare('INSERT OR IGNORE INTO used_names  (name)  VALUES (?)');
    const markQuote   = db.prepare('INSERT OR IGNORE INTO used_quotes (quote) VALUES (?)');

    let insertedId: number | bigint = 0;
    db.transaction(() => {
      const r = insertCat.run(filename, finalName, finalHood, finalQuote, uploaderName);
      insertedId = r.lastInsertRowid;
      if (fromPoolName)  markName.run(finalName);
      if (fromPoolQuote) markQuote.run(finalQuote);
    })();

    const cat = db.prepare('SELECT * FROM cats WHERE id = ?').get(insertedId);
    return NextResponse.json({ cat }, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
