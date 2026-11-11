'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import OrderStatusBadge from '@/components/OrderStatusBadge';
import { inr } from '@/lib/format';
import { ORDER_STATUS_LABELS, PAYMENT_METHOD_LABELS, PAYMENT_STATUS_LABELS } from '@/lib/order-status';

const formatDateTime = (value) =>
  new Date(value).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });

export default function OrderDetailPage() {
  const { id } = useParams();
  const { isLoggedIn, isLoading: authLoading, setLoginModalOpen } = useAuth();
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/orders/${id}`, { credentials: 'same-origin', cache: 'no-store' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Order not found.');
      setDetail(body);
      setError('');
    } catch (e) {
      setError(e.message);
    }
  }, [id]);

  useEffect(() => {
    if (isLoggedIn) load();
  }, [isLoggedIn, load]);

  const cancel = async () => {
    if (!window.confirm('Cancel this order? Items will go back into stock.')) return;
    setCancelling(true);
    try {
      const response = await fetch(`/api/orders/${id}/cancel`, { method: 'POST', credentials: 'same-origin', cache: 'no-store' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setDetail(body);
      setError('');
      if (body.cancellation?.alreadyFinal) {
        setNotice('This order was already cancelled.');
      } else if (body.cancellation?.refunded) {
        setNotice(body.cancellation.simulatedRefund
          ? 'Order cancelled. The demo payment refund was recorded.'
          : `Order cancelled. Refund reference: ${body.cancellation.refundId || 'submitted'}.`);
      } else {
        setNotice('Order cancelled successfully.');
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setCancelling(false);
    }
  };

  if (authLoading) return <div className="min-h-[60vh]" />;

  if (!isLoggedIn) {
    return (
      <div className="pt-32 pb-20 px-4 flex flex-col items-center justify-center min-h-[60vh] text-center">
        <h1 className="text-3xl font-bold text-white mb-4">Log in to view this order</h1>
        <button onClick={() => setLoginModalOpen(true)} className="px-8 py-3 bg-white text-black rounded-lg hover:bg-lighter-gray transition-all">Log in</button>
      </div>
    );
  }

  const { order, items = [], address, payments = [], history = [] } = detail || {};
  const payment = payments[payments.length - 1];

  return (
    <div className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <Link href="/orders" className="inline-flex items-center gap-2 text-light-gray hover:text-white transition-colors mb-8">
          <ArrowLeft className="w-5 h-5" /> All orders
        </Link>

        {error ? <p role="alert" className="mb-6 rounded-lg border border-red-500/40 px-4 py-3 text-sm text-red-300">{error}</p> : null}
        {notice ? <p role="status" className="mb-6 rounded-lg border border-emerald-500/30 px-4 py-3 text-sm text-emerald-200">{notice}</p> : null}
        {!detail && !error ? <p className="text-light-gray">Loading order…</p> : null}

        {detail && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold text-white mb-1">Order details</h1>
                <p className="text-light-gray font-mono text-sm break-all">{order.orderNumber}</p>
                <p className="text-light-gray text-sm">Placed {formatDateTime(order.createdAt)}</p>
              </div>
              <OrderStatusBadge status={order.status} />
            </div>

            {/* Items */}
            <section className="bg-dark-secondary border border-dark-border rounded-xl p-6" aria-labelledby="items-h">
              <h2 id="items-h" className="text-lg font-semibold text-white mb-4">Items</h2>
              <ul className="divide-y divide-dark-border">
                {items.map((item) => (
                  <li key={item.id} className="flex gap-4 py-4 first:pt-0 last:pb-0">
                    <img src={item.imageUrl || '/products/urban-tee.jpg'} alt="" className="w-20 h-20 rounded-lg object-cover bg-dark" />
                    <div className="flex-1">
                      {item.productId ? (
                        <Link href={`/products/${item.productId}`} className="text-white font-medium hover:underline">{item.productName}</Link>
                      ) : (
                        <p className="text-white font-medium">{item.productName}</p>
                      )}
                      <p className="text-light-gray text-sm">{item.size} · {item.color}</p>
                      <p className="text-light-gray text-sm">{inr(item.unitPrice, 2)} × {item.quantity}</p>
                    </div>
                    <p className="text-white font-semibold">{inr(item.lineTotal, 2)}</p>
                  </li>
                ))}
              </ul>
            </section>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Totals */}
              <section className="bg-dark-secondary border border-dark-border rounded-xl p-6 space-y-3" aria-labelledby="sum-h">
                <h2 id="sum-h" className="text-lg font-semibold text-white">Summary</h2>
                <div className="flex justify-between text-light-gray"><span>Subtotal</span><span>{inr(order.subtotal, 2)}</span></div>
                {order.discountAmount > 0 && (
                  <div className="flex justify-between text-green-400"><span>Discount{order.couponCode ? ` (${order.couponCode})` : ''}</span><span>−{inr(order.discountAmount, 2)}</span></div>
                )}
                <div className="flex justify-between text-light-gray"><span>Delivery</span><span>{order.shippingAmount === 0 ? 'FREE' : inr(order.shippingAmount, 2)}</span></div>
                <div className="flex justify-between text-white text-xl font-bold border-t border-dark-border pt-3"><span>Total</span><span>{inr(order.totalAmount, 2)}</span></div>
                {payment && (
                  <p className="text-sm text-light-gray pt-1">
                    {PAYMENT_METHOD_LABELS[payment.method] || payment.method} · {PAYMENT_STATUS_LABELS[order.paymentStatus] || order.paymentStatus}
                  </p>
                )}
              </section>

              {/* Address */}
              <section className="bg-dark-secondary border border-dark-border rounded-xl p-6" aria-labelledby="addr-h">
                <h2 id="addr-h" className="text-lg font-semibold text-white mb-3">Delivering to</h2>
                {address ? (
                  <address className="not-italic text-light-gray text-sm space-y-1">
                    <p className="text-white font-medium">{address.recipientName}</p>
                    <p>{address.line1}</p>
                    {address.line2 ? <p>{address.line2}</p> : null}
                    <p>{address.city}, {address.state} {address.postalCode}</p>
                    <p>Phone: {address.phone}</p>
                  </address>
                ) : (
                  <p className="text-light-gray text-sm">Address no longer on file.</p>
                )}
              </section>
            </div>

            {/* Timeline */}
            <section className="bg-dark-secondary border border-dark-border rounded-xl p-6" aria-labelledby="tl-h">
              <h2 id="tl-h" className="text-lg font-semibold text-white mb-4">Order progress</h2>
              <ol className="space-y-4">
                {[...history].reverse().map((h) => (
                  <li key={h.id} className="flex gap-3">
                    <span className="mt-1.5 h-2.5 w-2.5 flex-none rounded-full bg-white" aria-hidden="true" />
                    <div>
                      <p className="text-white text-sm font-medium">{ORDER_STATUS_LABELS[h.newStatus] || h.newStatus}</p>
                      {h.note ? <p className="text-light-gray text-sm">{h.note}</p> : null}
                      <p className="text-gray-500 text-xs">{formatDateTime(h.changedAt)}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </section>

            {detail.canCancel && (
              <button onClick={cancel} disabled={cancelling} className="px-6 py-3 border border-red-500/50 text-red-300 rounded-lg hover:bg-red-500/10 transition-colors disabled:opacity-50">
                {cancelling ? 'Cancelling…' : 'Cancel order'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
