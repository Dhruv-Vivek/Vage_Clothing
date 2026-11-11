import 'server-only';

/**
 * Server-side validation and guard helpers used before embedded database operations.
 * See backend/README.md for the database/backend walkthrough.
 */

// Use the same error class as the protected admin route wrapper so it can
// translate lifecycle errors into the intended HTTP status instead of a 500.
import { HttpError } from '@/lib/admin';
export { HttpError };

export function toCents(value) {
  const number = Number(value || 0);
  if (!Number.isFinite(number)) throw new HttpError(422, 'A price could not be calculated.');
  return Math.round(number * 100);
}

export function fromCents(value) {
  return Number((Number(value || 0) / 100).toFixed(2));
}
