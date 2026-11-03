'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, Package, Truck, CreditCard, Mail, CheckCircle2, Clock3 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

function money(value) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Number(value || 0));
}

function date(value) {
  if (!value) return '—';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '—' : new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(parsed);
}

const flow = ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED'];

export default function CustomerOrderDetailPage() {
  const params = useParams();
  const { isLoggedIn, isLoading: authLoading } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadOrder = useCallback(async () => {
    if (!isLoggedIn || !params?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const response = await fetch('/api/orders/' + params.id, { credentials: 'same-origin', cache: 'no-store' });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'Unable to load this order.');
      setData(body);
    } catch (err) {
      setError(err.message || 'Unable to load order.');
    } finally {
      setLoading(false);
    }
  }, [isLoggedIn, params?.id]);

  useEffect(() => {
    if (!authLoading) loadOrder();
  }, [authLoading, loadOrder]);

  if (authLoading || loading) return <div className="min-h-[65vh] bg-dark pt-40 text-center text-light-gray">Loading order…</div>;
  if (!isLoggedIn) return <div className="min-h-[65vh] bg-dark pt-40 text-center text-light-gray">Sign in to view this order.</div>;
  if (error || !data) return <div className="min-h-[65vh] bg-dark px-4 pt-40 text-center text-red-200">{error || 'Order not found.'}</div>;

  const order = data.order;
  const history = data.statusHistory || [];
  const currentIndex = flow.indexOf(order.status);

  return (
    <div className="min-h-screen bg-dark">
      <div className="mx-auto max-w-5xl px-4 pb-20 pt-32 sm:px-6 lg:px-8">
        <Link href="/account/orders" className="inline-flex items-center gap-2 text-sm text-light-gray hover:text-white"><ArrowLeft className="h-4 w-4" /> Back to orders</Link>
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mt-7 flex flex-col gap-4 rounded-2xl border border-dark-border bg-dark-secondary p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs tracking-wider text-light-gray">ORDER {order.order_number}</p>
            <h1 className="mt-2 text-3xl font-bold text-white">Order details</h1>
            <p className="mt-2 text-sm text-light-gray">Placed {date(order.created_at)}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-white/20 px-3 py-1 text-xs text-white">{order.status}</span>
            <span className="rounded-full border border-green-500/30 px-3 py-1 text-xs text-green-200">{order.payment_status}</span>
          </div>
        </motion.div>

        {order.status === 'CANCELLED' || order.status === 'RETURNED' ? (
          <div className="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/5 p-5 text-sm text-amber-100">This order is {order.status.toLowerCase()}. Contact VAGE support if you need assistance.</div>
        ) : (
          <section className="mt-7 rounded-2xl border border-dark-border bg-dark-secondary p-6">
            <div className="mb-6 flex items-center gap-3"><Truck className="h-5 w-5 text-light-gray" /><h2 className="text-xl font-semibold text-white">Delivery progress</h2></div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
              {flow.map((status, index) => {
                const reached = currentIndex >= index && currentIndex >= 0;
                return (
                  <div key={status} className="flex items-center gap-2 sm:flex-col sm:items-center sm:text-center">
                    <div className={'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border ' +
                      (reached ? 'border-white bg-white text-black' : 'border-dark-border text-light-gray')}>
                      {reached ? <CheckCircle2 className="h-5 w-5" /> : <Clock3 className="h-4 w-4" />}
                    </div>
                    <span className={'text-xs ' + (reached ? 'text-white' : 'text-light-gray')}>{status}</span>
                  </div>
                );
              })}
            </div>
            {history.length > 0 && (
              <div className="mt-7 space-y-3 border-t border-dark-border pt-5">
                {history.map((item) => (
                  <div key={item.history_id} className="flex gap-3 text-sm">
                    <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-light-gray" />
                    <div><p className="text-white">{item.new_status}</p><p className="text-xs text-light-gray">{date(item.changed_at)}{item.note ? ' · ' + item.note : ''}</p></div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        <div className="mt-7 grid grid-cols-1 gap-7 lg:grid-cols-[1.2fr_0.8fr]">
          <section className="rounded-2xl border border-dark-border bg-dark-secondary p-6">
            <div className="mb-5 flex items-center gap-3"><Package className="h-5 w-5 text-light-gray" /><h2 className="text-xl font-semibold text-white">Items</h2></div>
            <div className="space-y-4">
              {data.items.map((item, index) => (
                <div key={index} className="flex items-start justify-between gap-4 border-b border-dark-border pb-4 last:border-0">
                  <div>
                    <p className="font-medium text-white">{item.product_name}</p>
                    <p className="mt-1 text-xs text-light-gray">SKU {item.sku} · {item.size} · {item.color} · Qty {item.quantity}</p>
                    <p className="mt-1 text-xs text-light-gray">{money(item.unit_price)} each</p>
                  </div>
                  <p className="font-semibold text-white">{money(item.line_total)}</p>
                </div>
              ))}
            </div>
          </section>

          <div className="space-y-7">
            <section className="rounded-2xl border border-dark-border bg-dark-secondary p-6">
              <h2 className="mb-4 text-xl font-semibold text-white">Order summary</h2>
              <div className="space-y-3 text-sm text-light-gray">
                <div className="flex justify-between"><span>Subtotal</span><span>{money(order.subtotal)}</span></div>
                <div className="flex justify-between"><span>Discount</span><span>− {money(order.discount_amount)}</span></div>
                <div className="flex justify-between"><span>Shipping</span><span>{money(order.shipping_amount)}</span></div>
                <div className="flex justify-between border-t border-dark-border pt-4 text-lg font-bold text-white"><span>Total</span><span>{money(order.total_amount)}</span></div>
              </div>
            </section>
            <section className="rounded-2xl border border-dark-border bg-dark-secondary p-6">
              <h2 className="mb-4 text-xl font-semibold text-white">Delivery address</h2>
              <p className="text-sm leading-6 text-light-gray">
                {order.recipient_name}<br />{order.address_line1}{order.address_line2 ? ', ' + order.address_line2 : ''}<br />
                {order.city}, {order.state_name} {order.postal_code}<br />{order.country}<br />{order.phone}
              </p>
            </section>
            <section className="rounded-2xl border border-dark-border bg-dark-secondary p-6">
              <div className="mb-3 flex items-center gap-3"><CreditCard className="h-4 w-4 text-light-gray" /><h2 className="font-semibold text-white">Payment</h2></div>
              <p className="text-sm text-light-gray">{order.payment_provider || order.payment_method || 'Payment'} · {order.payment_status}</p>
              {order.transaction_ref && <p className="mt-1 break-all text-xs text-light-gray">Reference: {order.transaction_ref}</p>}
              <div className="mt-4 flex items-center gap-2 border-t border-dark-border pt-4"><Mail className="h-4 w-4 text-light-gray" /><span className="text-xs text-light-gray">Order email delivery: {data.emailDelivery?.map((row) => row.status).join(', ') || 'No email records'}</span></div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
