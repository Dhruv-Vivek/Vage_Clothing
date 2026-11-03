'use client';

import { useState } from 'react';
import { RotateCcw, XCircle } from 'lucide-react';

function date(value) {
  if (!value) return '—';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '—' : new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(parsed);
}
function money(value) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Number(value || 0));
}

export default function OrderActions({ order, items = [], returns = [], returnWindowOpen = false, onUpdated }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function cancelOrder() {
    if (!window.confirm('Cancel this order? A captured Razorpay payment will be refunded to the original payment method.')) return;
    setBusy(true); setMessage('');
    try {
      const response = await fetch(`/api/orders/${order.order_id}/cancel`, {
        method: 'POST', credentials: 'same-origin', cache: 'no-store',
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Unable to cancel this order.');
      setMessage(payload.refundId ? 'Order cancelled. Razorpay refund submitted.' : 'Order cancelled.');
      await onUpdated?.();
    } catch (error) { setMessage(error.message || 'Unable to cancel this order.'); }
    finally { setBusy(false); }
  }

  async function requestReturn(event, item) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true); setMessage('');
    try {
      const response = await fetch(`/api/orders/${order.order_id}/returns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        cache: 'no-store',
        body: JSON.stringify({
          orderItemId: item.order_item_id,
          quantity: Number(form.get('quantity')),
          reason: String(form.get('reason') || ''),
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Unable to submit return request.');
      setMessage('Return request submitted.');
      await onUpdated?.();
    } catch (error) { setMessage(error.message || 'Unable to submit return request.'); }
    finally { setBusy(false); }
  }

  const canCancel = ['CONFIRMED', 'PROCESSING'].includes(order.status);
  return (
    <section className="mt-6 space-y-4">
      {canCancel && (
        <div className="flex justify-end">
          <button type="button" disabled={busy} onClick={cancelOrder}
            className="inline-flex items-center gap-2 rounded-lg border border-red-400/40 px-4 py-2 text-sm text-red-200 hover:bg-red-400/10 disabled:opacity-50">
            <XCircle className="h-4 w-4" /> Cancel order
          </button>
        </div>
      )}
      {message && <p role="status" className="rounded-lg border border-dark-border bg-dark-secondary p-3 text-sm text-white">{message}</p>}

      {order.status === 'DELIVERED' && returnWindowOpen && (
        <div className="rounded-2xl border border-dark-border bg-dark-secondary p-6">
          <h2 className="mb-4 text-lg font-semibold text-white">Request a return</h2>
          <div className="space-y-4">
            {items.filter((item) => Number(item.quantity) > Number(item.return_requested_quantity || 0)).map((item) => {
              const remaining = Number(item.quantity) - Number(item.return_requested_quantity || 0);
              return (
                <form key={item.order_item_id} onSubmit={(event) => requestReturn(event, item)} className="rounded-xl border border-dark-border p-4">
                  <p className="text-sm font-medium text-white">{item.product_name} · {item.size} · {item.color}</p>
                  <p className="mt-1 text-xs text-light-gray">{remaining} unit(s) still eligible for return</p>
                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-[100px_1fr]">
                    <div>
                      <label className="mb-1 block text-xs text-light-gray">Quantity</label>
                      <input name="quantity" type="number" min="1" max={remaining} defaultValue="1" required className="w-full rounded-lg border border-dark-border bg-dark px-3 py-2 text-sm text-white" />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-light-gray">Reason (10–500 characters)</label>
                      <input name="reason" minLength="10" maxLength="500" required placeholder="Tell us why you are returning it" className="w-full rounded-lg border border-dark-border bg-dark px-3 py-2 text-sm text-white" />
                    </div>
                  </div>
                  <button disabled={busy} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-black disabled:opacity-50">
                    <RotateCcw className="h-4 w-4" /> Submit request
                  </button>
                </form>
              );
            })}
          </div>
        </div>
      )}

      {returns.length > 0 && (
        <div className="rounded-2xl border border-dark-border bg-dark-secondary p-6">
          <h2 className="mb-4 text-lg font-semibold text-white">Return history</h2>
          <div className="space-y-3">
            {returns.map((item) => (
              <div key={item.return_id} className="border-b border-dark-border pb-3 last:border-0">
                <div className="flex flex-wrap justify-between gap-2 text-sm">
                  <span className="text-white">{item.status} · {item.quantity} unit(s)</span>
                  <span className="text-light-gray">{date(item.requested_at)}</span>
                </div>
                <p className="mt-1 text-xs text-light-gray">{item.reason}</p>
                {item.resolution_notes && <p className="mt-1 text-xs text-light-gray">VAGE: {item.resolution_notes}</p>}
                {item.refund_amount !== null && <p className="mt-1 text-xs text-green-200">Refund: {money(item.refund_amount)}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
      {order.status === 'DELIVERED' && !returnWindowOpen && (
        <p className="text-xs text-light-gray">The return window has closed.</p>
      )}
    </section>
  );
}
