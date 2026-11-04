'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  IndianRupee, ShoppingBag, PackageCheck, Users, AlertTriangle, Mail,
  RefreshCw, TrendingUp, ArrowUpRight,
} from 'lucide-react';

function money(value) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(value || 0));
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
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-medium tracking-wide ${tone[value] || 'border-white/15 bg-white/5 text-white/60'}`}>{String(value || 'UNKNOWN').replaceAll('_', ' ')}</span>;
}
function Metric({ label, value, detail, icon: Icon, accent }) {
  return <div className="rounded-2xl border border-dark-border bg-dark-secondary p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-xs uppercase tracking-[0.16em] text-light-gray">{label}</p><p className="mt-3 text-3xl font-semibold tracking-tight">{value}</p><p className="mt-2 text-xs text-light-gray">{detail}</p></div><div className={`rounded-xl border border-dark-border p-3 ${accent || 'text-white'}`}><Icon className="h-5 w-5"/></div></div></div>;
}

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const response = await fetch('/api/admin/dashboard', { credentials: 'same-origin', cache: 'no-store' });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Unable to load dashboard.');
      setData(result);
    } catch (err) { setError(err.message || 'Unable to load dashboard.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  const maxRevenue = useMemo(() => Math.max(1, ...(data?.monthlyRevenue || []).map((v) => Number(v.revenue || 0))), [data]);
  return (
    <div>
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-xs uppercase tracking-[0.2em] text-light-gray">Store operations</p><h1 className="mt-2 text-3xl font-semibold">Store overview</h1><p className="mt-2 text-sm text-light-gray">Live orders, revenue, fulfilment and support metrics.</p></div>
        <button onClick={load} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-dark-border px-3 py-2 text-sm text-white hover:border-white disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}/> Refresh</button>
      </header>
      {error && <p role="alert" className="mb-5 rounded-lg border border-red-500/40 p-4 text-sm text-red-300">{error}</p>}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Paid revenue" value={loading ? '—' : money(data?.stats.totalRevenue)} detail="Successful payments" icon={IndianRupee}/>
        <Metric label="Total orders" value={loading ? '—' : data?.stats.totalOrders ?? 0} detail={`${data?.stats.paidOrders || 0} paid orders`} icon={ShoppingBag}/>
        <Metric label="To fulfil" value={loading ? '—' : data?.stats.ordersToFulfil ?? 0} detail="Paid, confirmed or processing" icon={PackageCheck}/>
        <Metric label="Customers" value={loading ? '—' : data?.stats.totalCustomers ?? 0} detail="Active customer accounts" icon={Users}/>
        <Metric label="Low-stock variants" value={loading ? '—' : data?.stats.lowStockVariants ?? 0} detail="Five units or fewer" icon={AlertTriangle}/>
        <Metric label="Support follow-up" value={loading ? '—' : data?.stats.unresolvedMessages ?? 0} detail="Email delivery needs attention" icon={Mail}/>
        <Metric label="Paid orders" value={loading ? '—' : data?.stats.paidOrders ?? 0} detail="Payment status verified" icon={TrendingUp}/>
        <Link href="/admin/orders" className="group flex items-center justify-between rounded-2xl border border-dark-border bg-dark-secondary p-5 transition hover:border-white"><div><p className="text-xs uppercase tracking-[0.16em] text-light-gray">Operations</p><p className="mt-3 text-lg font-semibold">Manage orders</p><p className="mt-1 text-xs text-light-gray">Search and review all orders</p></div><ArrowUpRight className="h-5 w-5 text-light-gray"/></Link>
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-2xl border border-dark-border bg-dark-secondary p-5 sm:p-6"><div className="flex items-center justify-between"><div><h2 className="text-lg font-semibold">Revenue trend</h2><p className="mt-1 text-xs text-light-gray">Successful payments · last six months</p></div><TrendingUp className="h-5 w-5 text-light-gray"/></div>
          <div className="mt-8 flex h-52 items-end gap-3">
            {(data?.monthlyRevenue || []).map((item) => <div key={item.month_start || item.month} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2"><span className="text-[10px] text-light-gray">{money(item.revenue)}</span><div className="flex w-full flex-1 items-end"><div className="w-full rounded-t-md bg-white/75 transition-all" style={{height:`${Math.max(3,(Number(item.revenue||0)/maxRevenue)*100)}%`}}/></div><span className="text-xs text-light-gray">{item.month}</span></div>)}
            {!loading && (data?.monthlyRevenue || []).length===0 && <p className="m-auto text-sm text-light-gray">No successful payments recorded yet.</p>}
          </div>
        </section>
        <section className="rounded-2xl border border-dark-border bg-dark-secondary p-5 sm:p-6"><h2 className="text-lg font-semibold">Order pipeline</h2><p className="mt-1 text-xs text-light-gray">Current order status distribution</p><div className="mt-5 space-y-4">
          {(data?.orderStatuses || []).map((item) => {const total=Math.max(1,data?.stats.totalOrders||0);const percent=Math.round((item.count/total)*100);return <div key={item.status}><div className="mb-1.5 flex justify-between text-xs"><span className="text-white/65">{item.status}</span><span className="text-light-gray">{item.count}</span></div><div className="h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-white/70" style={{width:percent+'%'}}/></div></div>;})}
          {!loading && (data?.orderStatuses || []).length===0 && <p className="text-sm text-light-gray">No orders yet.</p>}
        </div></section>
      </div>
      <section className="mt-6 overflow-hidden rounded-xl border border-dark-border bg-dark-secondary"><div className="flex items-center justify-between border-b border-dark-border px-5 py-5"><div><h2 className="text-lg font-semibold">Recent orders</h2><p className="mt-1 text-xs text-light-gray">Latest activity from the store</p></div><Link href="/admin/orders" className="text-xs text-light-gray hover:text-white">View all →</Link></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-dark text-xs uppercase tracking-wide text-light-gray"><tr><th className="px-5 py-3">Order</th><th className="px-5 py-3">Customer</th><th className="px-5 py-3">Items</th><th className="px-5 py-3">Order status</th><th className="px-5 py-3">Payment</th><th className="px-5 py-3 text-right">Total</th></tr></thead><tbody className="divide-y divide-dark-border">
          {(data?.recentOrders || []).map((order) => <tr key={order.order_id}><td className="px-5 py-4 font-medium">{order.order_number}</td><td className="px-5 py-4"><p>{order.customer_name}</p><p className="mt-1 text-xs text-light-gray">{order.customer_email}</p></td><td className="px-5 py-4 text-light-gray">{order.item_count}</td><td className="px-5 py-4"><Status value={order.status}/></td><td className="px-5 py-4"><Status value={order.payment_status}/></td><td className="px-5 py-4 text-right font-medium">{money(order.total_amount)}</td></tr>)}
          {!loading && (data?.recentOrders || []).length===0 && <tr><td colSpan="6" className="px-5 py-10 text-center text-light-gray">No orders yet.</td></tr>}
        </tbody></table></div>
      </section>
      <section className="mt-6 flex flex-wrap gap-3">
        <Link href="/admin/messages" className="inline-flex items-center gap-2 rounded-lg border border-dark-border px-4 py-3 text-sm hover:border-white"><Mail className="h-4 w-4"/> Contact inbox</Link>
        <Link href="/admin/product-intelligence" className="inline-flex items-center gap-2 rounded-lg border border-dark-border px-4 py-3 text-sm hover:border-white"><TrendingUp className="h-4 w-4"/> Product intelligence</Link>
      </section>
    </div>
  );
}
