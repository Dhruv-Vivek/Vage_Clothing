'use client';

import { useCallback, useEffect, useState } from 'react';
import { Search, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import AdminShell from '@/components/admin/AdminShell';

function money(value) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(value || 0));
}

function Pill({ value }) {
  const styles = {
    PAID: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300',
    DELIVERED: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300',
    FAILED: 'border-red-400/25 bg-red-400/10 text-red-300',
    CANCELLED: 'border-red-400/25 bg-red-400/10 text-red-300',
    PENDING: 'border-amber-300/25 bg-amber-300/10 text-amber-200',
    CONFIRMED: 'border-sky-300/25 bg-sky-300/10 text-sky-200',
    PROCESSING: 'border-sky-300/25 bg-sky-300/10 text-sky-200',
    SHIPPED: 'border-violet-300/25 bg-violet-300/10 text-violet-200',
  };
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] text-nowrap ${styles[value] || 'border-white/15 bg-white/5 text-white/60'}`}>{value}</span>;
}

const controlClass = 'rounded-lg border border-white/10 bg-[#111] px-3 py-2.5 text-sm text-white outline-none transition focus:border-white/40';

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 1 });
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async (page = 1) => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: '20' });
      if (query) params.set('q', query);
      if (status) params.set('status', status);
      if (paymentStatus) params.set('paymentStatus', paymentStatus);
      const response = await fetch('/api/admin/orders?' + params.toString(), { credentials: 'same-origin', cache: 'no-store' });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Unable to load orders.');
      setOrders(result.orders || []);
      setPagination(result.pagination || { page: 1, pageSize: 20, total: 0, totalPages: 1 });
    } catch (loadError) {
      setError(loadError.message || 'Unable to load orders.');
    } finally {
      setLoading(false);
    }
  }, [query, status, paymentStatus]);

  useEffect(() => { load(1); }, [load]);

  return (
    <AdminShell title="Orders" description="Search and review customer orders, fulfilment progress and verified payment status.">
      <div className="mb-5 rounded-2xl border border-white/10 bg-[#151515] p-4">
        <form onSubmit={(event) => { event.preventDefault(); setQuery(search.trim()); }} className="grid gap-3 md:grid-cols-[1fr_190px_190px_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search order number, customer or email" className={controlClass + ' w-full pl-9'} />
          </div>
          <select value={status} onChange={(event) => setStatus(event.target.value)} className={controlClass}>
            <option value="">All order statuses</option>
            {['PENDING','CONFIRMED','PROCESSING','SHIPPED','DELIVERED','CANCELLED','RETURNED'].map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
          <select value={paymentStatus} onChange={(event) => setPaymentStatus(event.target.value)} className={controlClass}>
            <option value="">All payment statuses</option>
            {['PENDING','PAID','FAILED','REFUNDED'].map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
          <button type="submit" className="rounded-lg bg-white px-5 py-2.5 text-sm font-medium text-black transition hover:bg-white/85">Search</button>
        </form>
      </div>

      {error && <div className="mb-4 rounded-xl border border-red-400/20 bg-red-400/5 p-4 text-sm text-red-200">{error} <button onClick={() => load(pagination.page)} className="ml-2 underline">Retry</button></div>}

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#151515]">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div><p className="font-medium">All orders</p><p className="mt-1 text-xs text-white/40">{pagination.total} result(s)</p></div>
          <button onClick={() => load(pagination.page)} disabled={loading} className="inline-flex items-center gap-2 text-xs text-white/55 hover:text-white disabled:opacity-40"><RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-white/[0.025] text-[10px] uppercase tracking-[0.14em] text-white/35">
              <tr><th className="px-5 py-3">Order</th><th className="px-5 py-3">Customer</th><th className="px-5 py-3">Placed</th><th className="px-5 py-3">Items</th><th className="px-5 py-3">Method</th><th className="px-5 py-3">Order status</th><th className="px-5 py-3">Payment</th><th className="px-5 py-3 text-right">Total</th></tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {orders.map((order) => (
                <tr key={order.order_id} className="hover:bg-white/[0.025]">
                  <td className="px-5 py-4 font-medium">{order.order_number}</td>
                  <td className="px-5 py-4"><p>{order.customer_name}</p><p className="mt-1 text-xs text-white/40">{order.customer_email}</p></td>
                  <td className="px-5 py-4 text-xs text-white/55">{new Date(order.created_at).toLocaleDateString('en-IN')}</td>
                  <td className="px-5 py-4 text-white/60">{order.item_count}</td>
                  <td className="px-5 py-4 text-xs text-white/55">{String(order.payment_method || '—').replaceAll('_', ' ')}</td>
                  <td className="px-5 py-4"><Pill value={order.status} /></td>
                  <td className="px-5 py-4"><Pill value={order.payment_status} /></td>
                  <td className="px-5 py-4 text-right font-medium">{money(order.total_amount)}</td>
                </tr>
              ))}
              {!loading && orders.length === 0 && <tr><td colSpan="8" className="px-5 py-12 text-center text-white/35">No matching orders found.</td></tr>}
              {loading && <tr><td colSpan="8" className="px-5 py-12 text-center text-white/35">Loading orders…</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-white/10 px-5 py-4">
          <p className="text-xs text-white/40">Page {pagination.page} of {pagination.totalPages}</p>
          <div className="flex gap-2">
            <button onClick={() => load(Math.max(1, pagination.page - 1))} disabled={loading || pagination.page <= 1} className="rounded-lg border border-white/10 p-2 text-white/60 hover:text-white disabled:opacity-30"><ChevronLeft className="h-4 w-4" /></button>
            <button onClick={() => load(Math.min(pagination.totalPages, pagination.page + 1))} disabled={loading || pagination.page >= pagination.totalPages} className="rounded-lg border border-white/10 p-2 text-white/60 hover:text-white disabled:opacity-30"><ChevronRight className="h-4 w-4" /></button>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
