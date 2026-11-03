'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  IndianRupee, ShoppingBag, PackageCheck, Users, AlertTriangle, Mail,
  RefreshCw, TrendingUp, ArrowUpRight,
} from 'lucide-react';
import AdminShell from '@/components/admin/AdminShell';

function money(value) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function dateTime(value) {
  return value ? new Date(value).toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }) : '—';
}

function Status({ value }) {
  const tone = {
    PAID: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300',
    DELIVERED: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300',
    FAILED: 'border-red-400/25 bg-red-400/10 text-red-300',
    CANCELLED: 'border-red-400/25 bg-red-400/10 text-red-300',
    PENDING: 'border-amber-300/25 bg-amber-300/10 text-amber-200',
    CONFIRMED: 'border-sky-300/25 bg-sky-300/10 text-sky-200',
    PROCESSING: 'border-sky-300/25 bg-sky-300/10 text-sky-200',
    SHIPPED: 'border-violet-300/25 bg-violet-300/10 text-violet-200',
  };
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-medium tracking-wide ${tone[value] || 'border-white/15 bg-white/5 text-white/60'}`}>
      {String(value || 'UNKNOWN').replaceAll('_', ' ')}
    </span>
  );
}

function Metric({ label, value, detail, icon: Icon, accent }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#151515] p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-white/45">{label}</p>
          <p className="mt-3 text-3xl font-semibold tracking-tight">{value}</p>
          <p className="mt-2 text-xs text-white/40">{detail}</p>
        </div>
        <div className={`rounded-xl border border-white/10 p-3 ${accent || 'bg-white/5 text-white/70'}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

export default function AdminDashboardPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/admin/dashboard', {
        credentials: 'same-origin',
        cache: 'no-store',
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Unable to load admin dashboard.');
      setData(result);
    } catch (loadError) {
      setError(loadError.message || 'Unable to load admin dashboard.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const maxRevenue = useMemo(
    () => Math.max(1, ...(data?.monthlyRevenue || []).map((item) => Number(item.revenue || 0))),
    [data]
  );

  return (
    <AdminShell
      title="Store overview"
      description="A live snapshot of VAGE orders, paid revenue, fulfilment and customer support."
    >
      {error ? (
        <div className="rounded-2xl border border-red-400/20 bg-red-400/5 p-6">
          <p className="font-medium text-red-200">{error}</p>
          <p className="mt-2 text-sm text-white/45">Admin data is available only to an active account with the ADMIN role.</p>
          <button onClick={load} className="mt-4 rounded-lg border border-white/15 px-4 py-2 text-sm hover:border-white/40">Try again</button>
        </div>
      ) : (
        <>
          <div className="mb-6 flex items-center justify-between">
            <p className="text-xs uppercase tracking-[0.2em] text-white/35">{loading ? 'Refreshing store data…' : 'Live store metrics'}</p>
            <button onClick={load} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs text-white/60 transition hover:border-white/30 hover:text-white disabled:opacity-40">
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Metric label="Paid revenue" value={loading ? '—' : money(data?.stats.totalRevenue)} detail="Successfully paid orders" icon={IndianRupee} accent="bg-emerald-400/10 text-emerald-300" />
            <Metric label="Total orders" value={loading ? '—' : data?.stats.totalOrders ?? 0} detail={`${data?.stats.paidOrders || 0} paid orders`} icon={ShoppingBag} />
            <Metric label="To fulfil" value={loading ? '—' : data?.stats.ordersToFulfil ?? 0} detail="Confirmed or processing" icon={PackageCheck} accent="bg-sky-400/10 text-sky-300" />
            <Metric label="Customers" value={loading ? '—' : data?.stats.totalCustomers ?? 0} detail="Active customer accounts" icon={Users} />
            <Metric label="Low-stock variants" value={loading ? '—' : data?.stats.lowStockVariants ?? 0} detail="Five units or fewer" icon={AlertTriangle} accent="bg-amber-300/10 text-amber-200" />
            <Metric label="Support follow-up" value={loading ? '—' : data?.stats.unresolvedMessages ?? 0} detail="Email delivery needs attention" icon={Mail} />
            <Metric label="Paid orders" value={loading ? '—' : data?.stats.paidOrders ?? 0} detail="Payment status verified" icon={TrendingUp} />
            <Link href="/admin/orders" className="group flex items-center justify-between rounded-2xl border border-white/15 bg-white/[0.04] p-5 transition hover:border-white/35 hover:bg-white/[0.07]">
              <div><p className="text-xs uppercase tracking-[0.16em] text-white/45">Operations</p><p className="mt-3 text-lg font-semibold">Manage orders</p><p className="mt-1 text-xs text-white/40">Search and review all orders</p></div>
              <ArrowUpRight className="h-5 w-5 text-white/50 transition group-hover:-translate-y-1 group-hover:translate-x-1 group-hover:text-white" />
            </Link>
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <section className="rounded-2xl border border-white/10 bg-[#151515] p-5 sm:p-6">
              <div className="flex items-center justify-between">
                <div><h2 className="text-lg font-semibold">Revenue trend</h2><p className="mt-1 text-xs text-white/40">Successful payments · last six months</p></div>
                <TrendingUp className="h-5 w-5 text-white/35" />
              </div>
              <div className="mt-8 flex h-52 items-end gap-3">
                {(data?.monthlyRevenue || []).map((item) => (
                  <div key={item.month_start || item.month} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2">
                    <span className="text-[10px] text-white/45">{money(item.revenue)}</span>
                    <div className="flex w-full flex-1 items-end">
                      <div className="w-full rounded-t-md bg-white/75 transition-all" style={{ height: `${Math.max(3, (Number(item.revenue || 0) / maxRevenue) * 100)}%` }} />
                    </div>
                    <span className="text-xs text-white/45">{item.month}</span>
                  </div>
                ))}
                {!loading && (data?.monthlyRevenue || []).length === 0 && <p className="m-auto text-sm text-white/35">No successful payments recorded yet.</p>}
              </div>
            </section>

            <section className="rounded-2xl border border-white/10 bg-[#151515] p-5 sm:p-6">
              <h2 className="text-lg font-semibold">Order pipeline</h2>
              <p className="mt-1 text-xs text-white/40">Current order status distribution</p>
              <div className="mt-5 space-y-4">
                {(data?.orderStatuses || []).map((item) => {
                  const total = Math.max(1, data?.stats.totalOrders || 0);
                  const percent = Math.round((item.count / total) * 100);
                  return (
                    <div key={item.status}>
                      <div className="mb-1.5 flex justify-between text-xs"><span className="text-white/65">{item.status}</span><span className="text-white/40">{item.count}</span></div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-white/70" style={{ width: percent + '%' }} /></div>
                    </div>
                  );
                })}
                {!loading && (data?.orderStatuses || []).length === 0 && <p className="text-sm text-white/35">No orders yet.</p>}
              </div>
            </section>
          </div>

          <section className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-[#151515]">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-5 sm:px-6">
              <div><h2 className="text-lg font-semibold">Recent orders</h2><p className="mt-1 text-xs text-white/40">Latest activity from the store</p></div>
              <Link href="/admin/orders" className="text-xs text-white/55 transition hover:text-white">View all →</Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-white/[0.025] text-[10px] uppercase tracking-[0.15em] text-white/35">
                  <tr><th className="px-5 py-3">Order</th><th className="px-5 py-3">Customer</th><th className="px-5 py-3">Items</th><th className="px-5 py-3">Order status</th><th className="px-5 py-3">Payment</th><th className="px-5 py-3 text-right">Total</th></tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06]">
                  {(data?.recentOrders || []).map((order) => (
                    <tr key={order.order_id} className="transition hover:bg-white/[0.025]">
                      <td className="px-5 py-4 font-medium">{order.order_number}</td>
                      <td className="px-5 py-4"><p>{order.customer_name}</p><p className="mt-1 text-xs text-white/40">{order.customer_email}</p></td>
                      <td className="px-5 py-4 text-white/60">{order.item_count}</td>
                      <td className="px-5 py-4"><Status value={order.status} /></td>
                      <td className="px-5 py-4"><Status value={order.payment_status} /></td>
                      <td className="px-5 py-4 text-right font-medium">{money(order.total_amount)}</td>
                    </tr>
                  ))}
                  {!loading && (data?.recentOrders || []).length === 0 && <tr><td colSpan="6" className="px-5 py-10 text-center text-white/35">No orders to show yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </AdminShell>
  );
}
