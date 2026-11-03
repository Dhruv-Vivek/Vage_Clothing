import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { HttpError, adminRoute } from '@/lib/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BYTES = 4 * 1024 * 1024;

/** Identify the real image type from its first bytes; never trust the filename or declared MIME type. */
function sniffImage(buffer) {
  if (buffer.length > 12) {
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpg';
    if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
    if (buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') {
      return 'webp';
    }
  }
  return null;
}

export const POST = adminRoute(async ({ request }) => {
  let form;
  try {
    form = await request.formData();
  } catch {
    throw new HttpError(400, 'Upload must be multipart form data.');
  }

  const file = form.get('file');
  if (!file || typeof file === 'string' || typeof file.arrayBuffer !== 'function') {
    throw new HttpError(400, 'Choose an image file to upload.');
  }
  if (file.size > MAX_BYTES) throw new HttpError(400, 'Image must be 4 MB or smaller.');

  const buffer = Buffer.from(await file.arrayBuffer());
  const ext = sniffImage(buffer);
  if (!ext) throw new HttpError(400, 'Only JPG, PNG or WebP images are allowed.');

  const name = `${Date.now()}-${randomBytes(6).toString('hex')}.${ext}`;
  const dir = path.join(process.cwd(), 'uploads', 'products');
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, name), buffer);

  return { url: `/api/media/${name}` };
});
