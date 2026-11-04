import { ORDER_STATUS_LABELS, ORDER_STATUS_TONES } from '@/lib/order-status';

export default function OrderStatusBadge({ status }) {
  return (
    <span
      className={`inline-block rounded-full border px-3 py-1 text-xs font-medium ${
        ORDER_STATUS_TONES[status] || ORDER_STATUS_TONES.RETURNED
      }`}
    >
      {ORDER_STATUS_LABELS[status] || status}
    </span>
  );
}
