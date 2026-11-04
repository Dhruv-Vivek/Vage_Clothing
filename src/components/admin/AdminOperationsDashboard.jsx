'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  IndianRupee, ShoppingBag, PackageCheck, Users, AlertTriangle, Mail,
  RefreshCw, TrendingUp, ArrowUpRight,
} from 'lucide-react';
import OrderStatusBadge from '@/components/OrderStatusBadge';
import { inr } from '@/lib/format';

function Metric({ label, value, detail, icon: Icon }) {
  return (
    <article className="rounded-xl border border-dark-border bg-dark-secondary p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-light-gray">{label}</p>
          <p className="mt-3 text-2xl font-semibold tracking-tight text-white">{value}</p>
          <p className="mt-2 text-xs text-light-gray">{detail}</p>
        </div>
        <span className="rounded-lg border border-dark-border p-3 text-light-gray"><Icon className="h-5 w-5" /></span>
      </div>
    </article>
  );
}

export default function AdminOperationsDashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/admin/dashboard', {
        credentials: 'same-origin',
        cache: 'no-store',
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'Unable to load dashboard metrics.');
      setData(body);
    } catch (loadError) {
      setError(loadError.message || 'Unable to load dashboard metrics.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const maxRevenue = useMemo(
    () => Math.max(1, ...(data?.monthlyRevenue || []).map((item) => Number(item.revenue || 0))),
    [data]
  );

  const stats = data?.stats || {};
  const statusTotal = Math.max(1, Number(stats.totalOrders || 0));

  return (
    <section className="mt-10 border-t border-dark-border pt-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-light-gray">Batch 7 · Operations</p>
          <h2 className="mt-2 text-xl font-semibold">Store performance</h2>
          <p className="mt-1 text-sm text-light-gray">Revenue, fulfilment, customer support and recent orders.</p>
        </div>
        <button type="button" onClick={load} disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-dark-border px-3 py-2 text-sm text-white hover:border-white disabled:opacity-50">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </header>

      {error ? (
        <p role="alert" className="mb-5 rounded-lg border border-red-500/40 p-4 text-sm text-red-300">{error}</p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Metric label="Paid revenue" value={loading ? '—' : inr(stats.totalRevenue || 0)} detail="Excludes cancelled and returned orders" icon={IndianRupee} />
        <Metric label="Total orders" value={loading ? '—' : Number(stats.totalOrders || 0)} detail={`${Number(stats.paidOrders || 0)} orders paid`} icon={ShoppingBag} />
        <Metric label="To fulfil" value={loading ? '—' : Number(stats.ordersToFulfil || 0)} detail="Orders from pending to shipped" icon={PackageCheck} />
        <Metric label="Active customers" value={loading ? '—' : Number(stats.totalCustomers || 0)} detail="Active customer accounts" icon={Users} />
        <Metric label="Low-stock variants" value={loading ? '—' : Number(stats.lowStockVariants || 0)} detail="Five units or fewer" icon={AlertTriangle} />
        <Metric label="Support follow-up" value={loading ? '—' : Number(stats.unresolvedMessages || 0)} detail="Contact emails not fully delivered" icon={Mail} />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <section className="rounded-xl border border-dark-border bg-dark-secondary p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold text-white">Revenue trend</h3>
              <p className="mt-1 text-xs text-light-gray">Successful payments · last six months</p>
            </div>
            <TrendingUp className="h-5 w-5 text-light-gray" />
          </div>
          <div className="mt-7 flex h-48 items-end gap-3">
            {(data?.monthlyRevenue || []).map((item) => (
              <div key={item.monthStart || item.month} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2">
                <span className="max-w-full truncate text-[10px] text-light-gray">{inr(item.revenue || 0)}</span>
                <div className="flex w-full flex-1 items-end">
                  <div className="w-full rounded-t bg-white/70" style={{ height: `${Math.max(3, Number(item.revenue || 0) / maxRevenue * 100)}%` }} />
                </div>
                <span className="text-xs text-light-gray">{item.month}</span>
              </div>
            ))}
            {!loading && (data?.monthlyRevenue || []).length === 0 ? (
              <p className="m-auto text-sm text-light-gray">No successful payments recorded yet.</p>
            ) : null}
          </div>
        </section>

        <section className="rounded-xl border border-dark-border bg-dark-secondary p-5">
          <h3 className="font-semibold text-white">Order pipeline</h3>
          <p className="mt-1 text-xs text-light-gray">Current order status distribution</p>
          <div className="mt-5 space-y-4">
            {(data?.orderStatuses || []).map((item) => {
              const percent = Math.round(Number(item.count || 0) / statusTotal * 100);
              return (
                <div key={item.status}>
                  <div className="mb-1.5 flex justify-between text-xs">
                    <span className="text-light-gray">{item.status}</span>
                    <span className="text-white">{Number(item.count || 0)}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-white/70" style={{ width: `${percent}%` }} />
                  </div>
                </div>
              );
            })}
            {!loading && (data?.orderStatuses || []).length === 0 ? (
              <p className="text-sm text-light-gray">No orders recorded yet.</p>
            ) : null}
          </div>
        </section>
      </div>

      <section className="mt-5 overflow-hidden rounded-xl border border-dark-border bg-dark-secondary">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-dark-border px-5 py-4">
          <div>
            <h3 className="font-semibold text-white">Recent orders</h3>
            <p className="mt-1 text-xs text-light-gray">Latest activity in the store</p>
          </div>
          <Link href="/admin/orders" className="inline-flex items-center gap-1 text-xs text-light-gray hover:text-white">
            Manage orders <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-left text-sm">
            <thead className="bg-dark text-xs uppercase tracking-wide text-light-gray">
              <tr>
                <th className="px-5 py-3 font-normal">Order</th>
                <th className="px-5 py-3 font-normal">Customer</th>
                <th className="px-5 py-3 font-normal">Items</th>
                <th className="px-5 py-3 font-normal">Status</th>
                <th className="px-5 py-3 font-normal">Payment</th>
                <th className="px-5 py-3 text-right font-normal">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-border">
              {(data?.recentOrders || []).map((order) => (
                <tr key={order.id}>
                  <td className="px-5 py-3">
                    <Link href={`/admin/orders/${order.id}`} className="font-mono text-xs text-white hover:underline">{order.orderNumber}</Link>
                  </td>
                  <td className="px-5 py-3">
                    <p className="text-white">{order.customerName}</p>
                    <p className="mt-1 text-xs text-light-gray">{order.customerEmail}</p>
                  </td>
                  <td className="px-5 py-3 text-light-gray">{order.itemCount}</td>
                  <td className="px-5 py-3"><OrderStatusBadge status={order.status} /></td>
                  <td className="px-5 py-3 text-xs text-light-gray">{order.paymentStatus}</td>
                  <td className="px-5 py-3 text-right font-medium text-white">{inr(order.totalAmount, 2)}</td>
                </tr>
              ))}
              {!loading && (data?.recentOrders || []).length === 0 ? (
                <tr><td colSpan={6} className="px-5 py-10 text-center text-light-gray">No orders yet.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <div className="mt-5 flex flex-wrap gap-3">
        <Link href="/admin/messages" className="inline-flex items-center gap-2 rounded-lg border border-dark-border px-4 py-2.5 text-sm text-white hover:border-white">
          <Mail className="h-4 w-4" /> Contact inbox
        </Link>
        <Link href="/admin/returns" className="inline-flex items-center gap-2 rounded-lg border border-dark-border px-4 py-2.5 text-sm text-white hover:border-white">
          <ShoppingBag className="h-4 w-4" /> Manage returns
        </Link>
        <Link href="/admin/product-intelligence" className="inline-flex items-center gap-2 rounded-lg border border-dark-border px-4 py-2.5 text-sm text-white hover:border-white">
          <TrendingUp className="h-4 w-4" /> Product intelligence
        </Link>
      </div>
    </section>
  );
}
