// Plain constants shared by server routes and client pages.
export const ORDER_STATUS_LABELS = {
  PENDING: 'Pending',
  CONFIRMED: 'Confirmed',
  PROCESSING: 'Processing',
  SHIPPED: 'Shipped',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
  RETURNED: 'Returned',
};

export const ORDER_STATUS_TONES = {
  PENDING: 'border-amber-500/40 text-amber-400',
  CONFIRMED: 'border-sky-500/40 text-sky-400',
  PROCESSING: 'border-sky-500/40 text-sky-400',
  SHIPPED: 'border-violet-500/40 text-violet-400',
  DELIVERED: 'border-emerald-500/40 text-emerald-400',
  CANCELLED: 'border-red-500/40 text-red-400',
  RETURNED: 'border-dark-border text-light-gray',
};

export const PAYMENT_STATUS_LABELS = {
  PENDING: 'Payment pending',
  PAID: 'Paid',
  FAILED: 'Payment failed',
  REFUNDED: 'Refunded',
};

export const PAYMENT_METHOD_LABELS = {
  COD: 'Cash on delivery',
  UPI: 'UPI',
  CARD: 'Card',
  NETBANKING: 'Net banking',
  WALLET: 'Wallet',
};

/**
 * Next steps an admin can pick. This mirrors the database trigger trg_order_status_guard
 * (the trigger is the real enforcer). RETURNED is left out until the returns workflow exists.
 */
export const ADMIN_NEXT_STATUS = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
  RETURNED: [],
};

/** A customer may cancel their own order only before it starts processing, and only if it is not already paid. */
export const CUSTOMER_CANCELLABLE = ['PENDING', 'CONFIRMED'];
