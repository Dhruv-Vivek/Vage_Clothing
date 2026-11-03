import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const TYPES = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };

/**
 * Serves admin-uploaded product images from /uploads/products. Files added to /public
 * after `next build` are not served by `next start`, so uploads live outside it.
 * Only filenames we generated (timestamp-hex.ext) are accepted, which rules out path traversal.
 */
export async function GET(_request, context) {
  const { name } = await context.params;
  const match = /^\d{10,}-[a-f0-9]{12}\.(jpg|png|webp)$/.exec(String(name));
  if (!match) return new NextResponse('Not found', { status: 404 });

  try {
    const data = await readFile(path.join(process.cwd(), 'uploads', 'products', name));
    return new NextResponse(data, {
      headers: {
        'Content-Type': TYPES[match[1]],
        'Cache-Control': 'public, max-age=31536000, immutable',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return new NextResponse('Not found', { status: 404 });
  }
}
