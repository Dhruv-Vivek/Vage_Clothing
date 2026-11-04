'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { inr } from '@/lib/format';
import { ORDER_STATUS_LABELS, PAYMENT_METHOD_LABELS, PAYMENT_STATUS_LABELS } from '@/lib/order-status';
import OrderStatusBadge from '@/components/OrderStatusBadge';
import { Pager, PageHeader, api, inputClass, useDebounced } from './ui';

const STATUS_TABS = ['all', 'PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'];

const formatDate = (value) =>
  new Date(value).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

export default function OrdersManager() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [payment, setPayment] = useState('all');
  const [page, setPage] = useState(1);
  const q = useDebounced(search);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({ status, paymentStatus: payment, page: String(page), pageSize: '20' });
      if (q) params.set('q', q);
      setData(await api(`/api/admin/orders?${params}`));
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }, [q, status, payment, page]);

  useEffect(() => {
    load();
  }, [load]);

  const total = data ? Object.values(data.counts).reduce((a, b) => a + b, 0) : null;

  return (
    <>
      <PageHeader title="Orders" description="Every order placed on the store, newest first. Open one to update its status." />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div role="tablist" aria-label="Filter by status" className="flex flex-wrap rounded-lg border border-dark-border p-0.5">
          {STATUS_TABS.map((value) => {
            const count = data ? (value === 'all' ? total : data.counts[value] || 0) : null;
            return (
              <button
                key={value}
                role="tab"
                aria-selected={status === value}
                onClick={() => {
                  setStatus(value);
                  setPage(1);
                }}
                className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                  status === value ? 'bg-white text-black' : 'text-light-gray hover:text-white'
                }`}
              >
                {value === 'all' ? 'All' : ORDER_STATUS_LABELS[value]}
                {count !== null ? <span className="ml-1.5 opacity-60">{count}</span> : null}
              </button>
            );
          })}
        </div>

        <div className="relative min-w-[12rem] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
          <input
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search order number, name or email"
            aria-label="Search orders"
            className={`${inputClass} pl-9`}
          />
        </div>

        <select
          value={payment}
          onChange={(e) => {
            setPayment(e.target.value);
            setPage(1);
          }}
          aria-label="Filter by payment"
          className={`${inputClass} w-auto`}
        >
          <option value="all">Any payment</option>
          <option value="PENDING">Payment pending</option>
          <option value="PAID">Paid</option>
          <option value="REFUNDED">Refunded</option>
        </select>
      </div>

      {error ? <p role="alert" className="mb-4 rounded-lg border border-red-500/40 px-4 py-3 text-sm text-red-300">{error}</p> : null}

      <div className="overflow-x-auto rounded-xl border border-dark-border">
        <table className="w-full min-w-[46rem] text-left text-sm">
          <thead className="border-b border-dark-border text-light-gray">
            <tr>
              <th className="px-4 py-3 font-normal">Order</th>
              <th className="px-4 py-3 font-normal">Customer</th>
              <th className="px-4 py-3 font-normal">Total</th>
              <th className="px-4 py-3 font-normal">Payment</th>
              <th className="px-4 py-3 font-normal">Status</th>
            </tr>
          </thead>
          <tbody>
            {!data && !error ? (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-light-gray">Loading orders…</td></tr>
            ) : null}
            {data && data.orders.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-light-gray">No orders match.</td></tr>
            ) : null}
            {data?.orders.map((o) => (
              <tr key={o.id} className="border-b border-dark-border last:border-0 hover:bg-dark-secondary/50">
                <td className="px-4 py-3">
                  <Link href={`/admin/orders/${o.id}`} className="block font-mono text-xs hover:underline">
                    {o.orderNumber.slice(0, 15)}…
                  </Link>
                  <span className="text-xs text-light-gray">{formatDate(o.createdAt)} · {o.itemCount} item{o.itemCount === 1 ? '' : 's'}</span>
                </td>
                <td className="px-4 py-3">
                  <span className="block">{o.customerName}</span>
                  <span className="text-xs text-light-gray">{o.customerEmail}</span>
                </td>
                <td className="px-4 py-3 font-medium">{inr(o.totalAmount, 2)}</td>
                <td className="px-4 py-3 text-light-gray">
                  {PAYMENT_METHOD_LABELS[o.paymentMethod] || o.paymentMethod || '—'}
                  <span className={`block text-xs ${o.paymentStatus === 'PAID' ? 'text-emerald-400' : ''}`}>
                    {PAYMENT_STATUS_LABELS[o.paymentStatus] || o.paymentStatus}
                  </span>
                </td>
                <td className="px-4 py-3"><OrderStatusBadge status={o.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pager pagination={data?.pagination} onPage={setPage} />
    </>
  );
}
