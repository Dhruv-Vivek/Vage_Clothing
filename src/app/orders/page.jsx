'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Package } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import OrderStatusBadge from '@/components/OrderStatusBadge';
import { inr } from '@/lib/format';

const formatDate = (value) =>
  new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

export default function MyOrdersPage() {
  const { isLoggedIn, isLoading: authLoading, setLoginModalOpen } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!isLoggedIn) return undefined;
    let cancelled = false;
    fetch(`/api/orders?page=${page}`, { credentials: 'same-origin', cache: 'no-store' })
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body.error);
        if (!cancelled) setData(body);
      })
      .catch((e) => !cancelled && setError(e.message || 'Could not load your orders.'));
    return () => {
      cancelled = true;
    };
  }, [isLoggedIn, page]);

  if (authLoading) return <div className="min-h-[60vh]" />;

  if (!isLoggedIn) {
    return (
      <div className="pt-32 pb-20 px-4 flex flex-col items-center justify-center min-h-[60vh] text-center">
        <Package className="w-20 h-20 text-light-gray mb-6" />
        <h1 className="text-3xl font-bold text-white mb-4">Log in to see your orders</h1>
        <button onClick={() => setLoginModalOpen(true)} className="px-8 py-3 bg-white text-black rounded-lg hover:bg-lighter-gray transition-all">
          Log in
        </button>
      </div>
    );
  }

  return (
    <div className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-10">My Orders</h1>

        {error ? <p role="alert" className="mb-6 rounded-lg border border-red-500/40 px-4 py-3 text-sm text-red-300">{error}</p> : null}
        {!data && !error ? <p className="text-light-gray">Loading your orders…</p> : null}

        {data && data.orders.length === 0 && (
          <div className="text-center py-16">
            <p className="text-light-gray mb-6">You haven&apos;t placed any orders yet.</p>
            <Link href="/products" className="px-8 py-3 bg-white text-black rounded-lg hover:bg-lighter-gray transition-all">
              Start shopping
            </Link>
          </div>
        )}

        <div className="space-y-4">
          {data?.orders.map((order) => (
            <Link
              key={order.id}
              href={`/orders/${order.id}`}
              className="block bg-dark-secondary border border-dark-border rounded-xl p-6 hover:border-white transition-colors"
            >
              <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                <div>
                  <p className="text-white font-mono text-sm break-all">{order.orderNumber}</p>
                  <p className="text-light-gray text-sm">Placed {formatDate(order.createdAt)}</p>
                </div>
                <OrderStatusBadge status={order.status} />
              </div>

              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex -space-x-2">
                    {order.items.map((item, i) => (
                      <img
                        key={i}
                        src={item.imageUrl || '/products/urban-tee.jpg'}
                        alt=""
                        className="w-12 h-12 rounded-lg object-cover border-2 border-dark-secondary"
                      />
                    ))}
                  </div>
                  <p className="text-light-gray text-sm truncate">
                    {order.items[0]?.name}
                    {order.itemCount > 1 ? ` and ${order.itemCount - 1} more` : ''}
                  </p>
                </div>
                <p className="text-white text-xl font-bold whitespace-nowrap">{inr(order.totalAmount, 2)}</p>
              </div>
            </Link>
          ))}
        </div>

        {data && data.pagination.totalPages > 1 && (
          <div className="mt-8 flex items-center justify-between text-sm text-light-gray">
            <span>Page {data.pagination.page} of {data.pagination.totalPages}</span>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="px-4 py-2 border border-dark-border rounded-lg text-white disabled:opacity-40">Previous</button>
              <button disabled={page >= data.pagination.totalPages} onClick={() => setPage(page + 1)} className="px-4 py-2 border border-dark-border rounded-lg text-white disabled:opacity-40">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
