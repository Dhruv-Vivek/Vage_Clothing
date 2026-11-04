import 'server-only';

import { NextResponse } from 'next/server';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { getPool } from '@/lib/db';

/** A variant with this many units or fewer is treated as "low stock". Override with LOW_STOCK_THRESHOLD in .env.local. */
export const LOW_STOCK_THRESHOLD = (() => {
  const n = Number.parseInt(process.env.LOW_STOCK_THRESHOLD ?? '', 10);
  return Number.isInteger(n) && n >= 0 && n <= 1000 ? n : 5;
})();

export const PRODUCT_STATUSES = ['DRAFT', 'ACTIVE', 'ARCHIVED'];

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/* ------------------------------------------------------------------ */
/* Access control                                                      */
/* ------------------------------------------------------------------ */

/**
 * For server components (pages/layouts). Sends anyone who is not a signed-in,
 * active ADMIN back to the storefront. The role is re-read from MySQL on every
 * request (see getCurrentUser), so demoting an admin takes effect immediately.
 */
export async function requireAdminPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== 'ADMIN') redirect('/');
  return user;
}

const DB_ERROR_MESSAGES = [
  ['uq_variants_sku', 409, 'That SKU is already in use.'],
  ['uq_variant_options', 409, 'This product already has a variant with that size and colour.'],
  ['uq_products_slug', 409, 'A product with a very similar name already exists.'],
];

function describeDbError(error) {
  if (error?.code === 'ER_DUP_ENTRY') {
    const message = String(error.sqlMessage || '');
    const known = DB_ERROR_MESSAGES.find(([key]) => message.includes(key));
    return known ? [known[1], known[2]] : [409, 'That value already exists.'];
  }
  if (error?.code === 'ER_NO_REFERENCED_ROW_2') return [400, 'The selected category does not exist.'];
  if (error?.code === 'ER_CHECK_CONSTRAINT_VIOLATED') return [400, 'A value is outside the allowed range.'];
  return null;
}

/**
 * Wraps an /api/admin/* handler: verifies the caller is an ADMIN, resolves route
 * params, turns HttpError / known MySQL errors into clean JSON responses, and
 * never leaks internals. Handler receives { request, params, user }.
 */
export function adminRoute(handler) {
  return async function route(request, context) {
    try {
      const user = await getCurrentUser();
      if (!user) throw new HttpError(401, 'Sign in required.');
      if (user.role !== 'ADMIN') throw new HttpError(403, 'Admin access required.');

      const params = context?.params ? await context.params : {};
      const result = await handler({ request, params, user });
      if (result instanceof Response) return result;
      return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
      if (error instanceof HttpError) {
        return NextResponse.json({ error: error.message }, { status: error.status });
      }
      const mapped = describeDbError(error);
      if (mapped) return NextResponse.json({ error: mapped[1] }, { status: mapped[0] });

      console.error(`[admin ${request.method} ${new URL(request.url).pathname}]`, error);
      return NextResponse.json(
        { error: 'Something went wrong. Please try again.' },
        { status: 500 }
      );
    }
  };
}


/** Convert shared API errors into safe customer-facing JSON responses. */
export function toErrorResponse(error, request) {
  if (error instanceof HttpError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  const mapped = describeDbError(error);
  if (mapped) {
    return NextResponse.json({ error: mapped[1] }, { status: mapped[0] });
  }
  if (error?.code === 'ER_LOCK_DEADLOCK' || error?.code === 'ER_LOCK_WAIT_TIMEOUT') {
    return NextResponse.json({ error: 'The order is being updated by another request. Please retry.' }, { status: 409 });
  }
  const method = request?.method || 'REQUEST';
  const pathname = request?.url ? new URL(request.url).pathname : '/api';
  console.error(`[${method} ${pathname}]`, error);
  return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
}

/* ------------------------------------------------------------------ */
/* Input validation                                                    */
/* ------------------------------------------------------------------ */

export async function readJson(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    throw new HttpError(400, 'Request body must be valid JSON.');
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new HttpError(400, 'A JSON object is required.');
  }
  return body;
}

export function toId(value, label = 'ID') {
  const text = String(value ?? '');
  if (!/^\d{1,15}$/.test(text) || Number(text) <= 0) {
    throw new HttpError(400, `${label} is invalid.`);
  }
  return Number(text);
}

export function cleanText(value, { label, max, required = false, multiline = false }) {
  if (value === undefined || value === null) {
    if (required) throw new HttpError(400, `${label} is required.`);
    return null;
  }
  if (typeof value !== 'string') throw new HttpError(400, `${label} must be text.`);
  const text = multiline ? value.trim() : value.trim().replace(/\s+/g, ' ');
  if (!text) {
    if (required) throw new HttpError(400, `${label} is required.`);
    return null;
  }
  if (text.length > max) throw new HttpError(400, `${label} must be ${max} characters or fewer.`);
  return text;
}

export function cleanMoney(value, label, { nullable = false } = {}) {
  if (value === undefined || value === null || value === '') {
    if (nullable) return null;
    throw new HttpError(400, `${label} is required.`);
  }
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 1_000_000) {
    throw new HttpError(400, `${label} must be between 0 and 1,000,000.`);
  }
  return Math.round(n * 100) / 100;
}

export function cleanInt(value, label, { min = 0, max = 1_000_000 } = {}) {
  const n = typeof value === 'string' && value.trim() === '' ? NaN : Number(value);
  if (!Number.isInteger(n) || n < min || n > max) {
    throw new HttpError(400, `${label} must be a whole number between ${min} and ${max}.`);
  }
  return n;
}

/** Accepts a site-relative path (/products/x.jpg, /api/media/x.jpg) or an https URL. Blocks javascript:/data: URLs. */
export function cleanImageUrl(value) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') throw new HttpError(400, 'Image URL must be text.');
  const url = value.trim();
  if (url.length > 255 || !/^(\/(?!\/)[A-Za-z0-9._~/-]*|https?:\/\/[^\s"'<>]+)$/.test(url)) {
    throw new HttpError(400, 'Image must be an uploaded file, a /path, or an http(s) URL under 255 characters.');
  }
  return url;
}

export function slugify(text) {
  return (
    String(text)
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 120) || 'product'
  );
}

export function escapeLike(text) {
  return text.replace(/[\\%_]/g, '\\$&');
}

/* ------------------------------------------------------------------ */
/* Database helpers                                                    */
/* ------------------------------------------------------------------ */

/** Run fn(connection) inside a transaction; commits on success, rolls back on any error. */
export async function withTransaction(fn) {
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    const result = await fn(connection);
    await connection.commit();
    return result;
  } catch (error) {
    try {
      await connection.rollback();
    } catch {
      /* connection already gone */
    }
    throw error;
  } finally {
    connection.release();
  }
}

/** Parameterised query on a transaction connection; returns rows (or the OK packet). */
export async function run(connection, sql, params = []) {
  const [rows] = await connection.execute(sql, params);
  return rows;
}
