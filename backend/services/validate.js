import 'server-only';

/**
 * Server-side request and SQL transaction validation helpers.
 * See backend/README.md for the database/backend walkthrough.
 */

// One import point for request validation helpers used by customer and admin routes.
export {
  HttpError,
  cleanInt,
  cleanMoney,
  cleanText,
  escapeLike,
  readJson,
  run,
  toId,
  withTransaction,
} from '@/lib/admin';

import { HttpError, cleanText } from '@/lib/admin';

/** Digits only, 10-15 long (matches the addresses.phone CHECK constraint). "+91 98765 43210" becomes 919876543210. */
export function cleanPhone(value) {
  const digits = String(value ?? '').replace(/[\s().+-]/g, '');
  if (!/^[0-9]{10,15}$/.test(digits)) {
    throw new HttpError(400, 'Enter a valid phone number (10 to 15 digits).');
  }
  return digits;
}

export function cleanAddress(body) {
  const country = cleanText(body.country, { label: 'Country', max: 80 }) || 'India';
  const postalCode = cleanText(body.postalCode, { label: 'PIN code', max: 20, required: true });
  if (country === 'India' && !/^[0-9]{6}$/.test(postalCode)) {
    throw new HttpError(400, 'Enter a valid 6-digit PIN code.');
  }
  return {
    recipientName: cleanText(body.recipientName, { label: 'Full name', max: 120, required: true }),
    phone: cleanPhone(body.phone),
    line1: cleanText(body.addressLine1, { label: 'Address', max: 200, required: true }),
    line2: cleanText(body.addressLine2, { label: 'Address line 2', max: 200 }),
    city: cleanText(body.city, { label: 'City', max: 100, required: true }),
    state: cleanText(body.state, { label: 'State', max: 100, required: true }),
    postalCode,
    country,
  };
}
