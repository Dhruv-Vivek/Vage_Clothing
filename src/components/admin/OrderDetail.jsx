'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { inr } from '@/lib/format';
import { ORDER_STATUS_LABELS, PAYMENT_METHOD_LABELS, PAYMENT_STATUS_LABELS } from '@/lib/order-status';
import OrderStatusBadge from '@/components/OrderStatusBadge';
import { Thumb, api, ghostButton, inputClass, primaryButton, useToast } from './ui';

const formatDateTime = (value) =>
  new Date(value).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });

export default function OrderDetail({ orderId }) {
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const { toast, notify } = useToast();

  const load = useCallback(async () => {
    try {
      setDetail(await api(`/api/admin/orders/${orderId}`));
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }, [orderId]);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (request, success) => {
    setBusy(true);
    try {
      setDetail(await request());
      setNote('');
      notify(success);
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const moveTo = (status) => {
    if (status === 'CANCELLED' && !window.confirm('Cancel this order? The items go back into stock.')) return;
    act(
      () => api(`/api/admin/orders/${orderId}`, { method: 'PATCH', body: { nextStatus: status, note } }),
      `Order marked ${ORDER_STATUS_LABELS[status].toLowerCase()}`
    );
  };

  const markPaid = () =>
    act(() => api(`/api/admin/orders/${orderId}/payment`, { method: 'POST', body: { reference: note } }), 'Payment recorded');

  if (error) return <p role="alert" className="rounded-lg border border-red-500/40 px-4 py-3 text-sm text-red-300">{error}</p>;
  if (!detail) return <p className="text-light-gray">Loading order…</p>;

  const { order, customer, address, items, payments, history, nextStatuses } = detail;
  const payment = payments[payments.length - 1];
  const canMarkPaid = false;

  return (
    <>
      <Link href="/admin/orders" className="mb-4 inline-flex items-center gap-2 text-sm text-light-gray hover:text-white">
        <ArrowLeft className="h-4 w-4" /> All orders
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Order</h1>
          <p className="font-mono text-sm text-light-gray break-all">{order.orderNumber}</p>
          <p className="text-sm text-light-gray">Placed {formatDateTime(order.createdAt)}</p>
        </div>
        <OrderStatusBadge status={order.status} />
      </div>

      {/* Actions */}
      {(nextStatuses.length > 0 || canMarkPaid) && (
        <section aria-labelledby="actions-h" className="mb-6 rounded-xl border border-dark-border p-5">
          <h2 id="actions-h" className="mb-3 text-sm font-medium">Update this order</h2>
          <input
            className={`${inputClass} mb-3`}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={400}
            placeholder="Optional note (shown to the customer in the order progress, or used as the payment reference)"
            aria-label="Note"
          />
          <div className="flex flex-wrap gap-2">
            {nextStatuses.map((status) =>
              status === 'CANCELLED' ? (
                <button key={status} disabled={busy} onClick={() => moveTo(status)}
                  className={`${ghostButton} border-red-500/50 text-red-300 hover:border-red-400`}>
                  Cancel order
                </button>
              ) : (
                <button key={status} disabled={busy} onClick={() => moveTo(status)} className={primaryButton}>
                  Mark {ORDER_STATUS_LABELS[status].toLowerCase()}
                </button>
              )
            )}
            {canMarkPaid && (
              <button disabled={busy} onClick={markPaid} className={ghostButton}>
                Record payment received
              </button>
            )}
          </div>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section aria-labelledby="items-h" className="rounded-xl border border-dark-border p-5">
            <h2 id="items-h" className="mb-4 text-sm font-medium">Items</h2>
            <ul className="divide-y divide-dark-border">
              {items.map((item) => (
                <li key={item.id} className="flex items-center gap-4 py-3 first:pt-0 last:pb-0">
                  <Thumb src={item.imageUrl} alt="" />
                  <div className="flex-1 min-w-0">
                    <p className="truncate font-medium">{item.productName}</p>
                    <p className="text-xs text-light-gray">{item.size} · {item.color} · {item.sku}</p>
                    <p className="text-xs text-light-gray">{inr(item.unitPrice, 2)} × {item.quantity}</p>
                  </div>
                  <p className="font-medium">{inr(item.lineTotal, 2)}</p>
                </li>
              ))}
            </ul>
            <dl className="mt-4 space-y-1.5 border-t border-dark-border pt-4 text-sm">
              <div className="flex justify-between text-light-gray"><dt>Subtotal</dt><dd>{inr(order.subtotal, 2)}</dd></div>
              {order.discountAmount > 0 && (
                <div className="flex justify-between text-emerald-400"><dt>Discount{order.couponCode ? ` (${order.couponCode})` : ''}</dt><dd>−{inr(order.discountAmount, 2)}</dd></div>
              )}
              <div className="flex justify-between text-light-gray"><dt>Delivery</dt><dd>{order.shippingAmount === 0 ? 'Free' : inr(order.shippingAmount, 2)}</dd></div>
              <div className="flex justify-between text-base font-semibold"><dt>Total</dt><dd>{inr(order.totalAmount, 2)}</dd></div>
            </dl>
          </section>

          <section aria-labelledby="hist-h" className="rounded-xl border border-dark-border p-5">
            <h2 id="hist-h" className="mb-4 text-sm font-medium">History</h2>
            <ol className="space-y-4">
              {[...history].reverse().map((h) => (
                <li key={h.id} className="flex gap-3">
                  <span className="mt-1.5 h-2 w-2 flex-none rounded-full bg-white" aria-hidden="true" />
                  <div className="text-sm">
                    <p className="font-medium">{ORDER_STATUS_LABELS[h.newStatus]}</p>
                    {h.note ? <p className="text-light-gray">{h.note}</p> : null}
                    <p className="text-xs text-gray-500">
                      {formatDateTime(h.changedAt)}{h.changedBy ? ` · ${h.changedBy}` : ''}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <div className="space-y-6">
          <section aria-labelledby="cust-h" className="rounded-xl border border-dark-border p-5 text-sm">
            <h2 id="cust-h" className="mb-3 font-medium">Customer</h2>
            <p>{customer.name}</p>
            <p className="text-light-gray break-all">{customer.email}</p>
            {customer.phone ? <p className="text-light-gray">{customer.phone}</p> : null}
          </section>

          <section aria-labelledby="ship-h" className="rounded-xl border border-dark-border p-5 text-sm">
            <h2 id="ship-h" className="mb-3 font-medium">Ship to</h2>
            {address ? (
              <address className="not-italic space-y-0.5 text-light-gray">
                <p className="text-white">{address.recipientName}</p>
                <p>{address.line1}</p>
                {address.line2 ? <p>{address.line2}</p> : null}
                <p>{address.city}, {address.state} {address.postalCode}</p>
                <p>Phone: {address.phone}</p>
              </address>
            ) : (
              <p className="text-light-gray">Address no longer on file.</p>
            )}
          </section>

          <section aria-labelledby="pay-h" className="rounded-xl border border-dark-border p-5 text-sm">
            <h2 id="pay-h" className="mb-3 font-medium">Payment</h2>
            {payment ? (
              <div className="space-y-0.5 text-light-gray">
                <p className="text-white">{PAYMENT_METHOD_LABELS[payment.method] || payment.method}</p>
                <p className={order.paymentStatus === 'PAID' ? 'text-emerald-400' : ''}>{PAYMENT_STATUS_LABELS[order.paymentStatus]}</p>
                {payment.transactionRef ? <p>Ref: {payment.transactionRef}</p> : null}
                {payment.paidAt ? <p>{formatDateTime(payment.paidAt)}</p> : null}
              </div>
            ) : (
              <p className="text-light-gray">No payment record.</p>
            )}
          </section>
        </div>
      </div>
      {toast}
    </>
  );
}
