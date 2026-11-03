'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Package, ChevronLeft, ChevronRight, ShoppingBag } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

function money(value) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Number(value || 0));
}

function tone(status) {
  if (status === 'DELIVERED' || status === 'CONFIRMED') return 'text-green-300 border-green-500/30';
  if (status === 'CANCELLED' || status === 'RETURNED') return 'text-red-300 border-red-500/30';
  return 'text-amber-200 border-amber-500/30';
}

export default function CustomerOrdersPage() {
  const { isLoggedIn, isLoading: authLoading } = useAuth();
  const [orders, setOrders] = useState([]);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadOrders = useCallback(async (pageNumber) => {
    if (!isLoggedIn) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/account/orders?page=' + pageNumber, { credentials: 'same-origin', cache: 'no-store' });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'Unable to load orders.');
      setOrders(body.orders || []);
      setPagination(body.pagination || null);
    } catch (err) {
      setError(err.message || 'Unable to load order history.');
    } finally {
      setLoading(false);
    }
  }, [isLoggedIn]);

  useEffect(() => {
    if (!authLoading) loadOrders(page);
  }, [authLoading, loadOrders, page]);

  if (authLoading || loading) return <div className="min-h-[65vh] bg-dark pt-40 text-center text-light-gray">Loading your orders…</div>;
  if (!isLoggedIn) return <div className="min-h-[65vh] bg-dark px-4 pt-40 text-center text-light-gray">Sign in to view your order history.</div>;

  return (
    <div className="min-h-screen bg-dark">
      <div className="mx-auto max-w-6xl px-4 pb-20 pt-32 sm:px-6 lg:px-8">
        <p className="text-xs tracking-[0.3em] text-light-gray">CUSTOMER SPACE</p>
        <h1 className="mt-3 text-4xl font-bold text-white md:text-5xl">My orders</h1>
        <p className="mt-3 text-light-gray">Review your purchases and follow their delivery status.</p>

        {error && <p role="alert" className="mt-6 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-100">{error}</p>}

        {!error && orders.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-dark-border bg-dark-secondary p-10 text-center">
            <ShoppingBag className="mx-auto mb-4 h-12 w-12 text-light-gray" />
            <h2 className="text-xl font-semibold text-white">No orders yet</h2>
            <p className="mt-2 text-sm text-light-gray">Your VAGE orders will appear here after checkout.</p>
            <Link href="/products" className="mt-6 inline-block rounded-lg bg-white px-6 py-3 font-semibold text-black">Explore collection</Link>
          </div>
        ) : (
          <div className="mt-9 space-y-4">
            {orders.map((order, index) => (
              <motion.article key={order.orderId} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04 }}
                className="flex flex-col gap-5 rounded-2xl border border-dark-border bg-dark-secondary p-5 sm:flex-row sm:items-center">
                <div className="h-24 w-20 shrink-0 overflow-hidden rounded-lg bg-dark">
                  <img src={order.previewImage || '/products/urban-tee.jpg'} alt="" className="h-full w-full object-cover" onError={(event) => { event.currentTarget.src = '/products/urban-tee.jpg'; }} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs tracking-wider text-light-gray">{order.orderNumber}</p>
                  <h2 className="mt-1 text-lg font-semibold text-white">{money(order.totalAmount)}</h2>
                  <p className="mt-1 text-sm text-light-gray">{order.itemCount} item(s) · {new Date(order.createdAt).toLocaleDateString('en-IN')}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className={'rounded-full border px-3 py-1 text-xs ' + tone(order.status)}>{order.status}</span>
                    <span className={'rounded-full border px-3 py-1 text-xs ' + tone(order.paymentStatus)}>{order.paymentStatus}</span>
                  </div>
                </div>
                <Link href={'/account/orders/' + order.orderId} className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/60 px-5 py-3 text-sm font-medium text-white transition hover:bg-white hover:text-black">
                  <Package className="h-4 w-4" /> View order
                </Link>
              </motion.article>
            ))}
          </div>
        )}

        {pagination && pagination.totalPages > 1 && (
          <div className="mt-8 flex items-center justify-between">
            <button onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1}
              className="inline-flex items-center gap-2 rounded-lg border border-dark-border px-4 py-2 text-sm text-white disabled:opacity-30">
              <ChevronLeft className="h-4 w-4" /> Previous
            </button>
            <span className="text-sm text-light-gray">Page {page} of {pagination.totalPages}</span>
            <button onClick={() => setPage((current) => Math.min(pagination.totalPages, current + 1))} disabled={!pagination.hasNextPage}
              className="inline-flex items-center gap-2 rounded-lg border border-dark-border px-4 py-2 text-sm text-white disabled:opacity-30">
              Next <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
