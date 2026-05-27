import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';

// Serves uploaded cat images from the data dir (Railway volume) with fallback to public/cats
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;
  if (!filename || filename.includes('..') || filename.includes('/')) {
    return new NextResponse('Not found', { status: 404 });
  }

  const uploadsDir = process.env.UPLOADS_DIR || path.join(process.cwd(), 'public', 'cats');
  const filePath = path.join(uploadsDir, filename);

  try {
    const data = await readFile(filePath);
    const ext = filename.split('.').pop()?.toLowerCase() || 'jpg';
    const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
    return new NextResponse(data, {
      headers: {
        'Content-Type': mime,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch {
    return new NextResponse('Not found', { status: 404 });
  }
}
