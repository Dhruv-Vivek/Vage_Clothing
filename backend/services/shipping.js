import 'server-only';

/**
 * Backend pricing rules for shipping and membership delivery options.
 * See backend/README.md for the database/backend walkthrough.
 */

import { deliveryOptions } from '@/data/products';
import { HttpError } from '@/lib/admin';

/**
 * Delivery price is decided here on the server, from the same table the checkout page displays.
 * The browser only says WHICH option it wants, never how much it costs.
 */
export function resolveDelivery(optionId, membership) {
  const option = deliveryOptions.find((o) => o.id === optionId);
  if (!option) throw new HttpError(400, 'Choose a delivery option.');
  const isMember = ['basic', 'premium', 'vip'].includes(membership);
  return { id: option.id, name: option.name, days: option.days, amount: isMember ? 0 : option.price };
}
