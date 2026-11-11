'use client';

import { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { api, PageHeader, ghostButton, primaryButton } from './ui';

const FILTERS = ['all', 'REQUESTED', 'APPROVED', 'REJECTED', 'RECEIVED', 'REFUNDED'];

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

export default function ReturnsManager() {
  const [status, setStatus] = useState('all');
  const [returns, setReturns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ limit: '100' });
      if (status !== 'all') params.set('status', status);
      const data = await api(`/api/admin/returns?${params}`);
      setReturns(data.returns || []);
    } catch (loadError) {
      setError(loadError.message || 'Unable to load returns.');
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => { load(); }, [load]);

  const update = async (item, nextStatus) => {
    let notes = '';
    if (nextStatus === 'REJECTED') {
      notes = window.prompt('Add a reason for rejecting this return request:') || '';
      if (!notes.trim()) return;
    }
    if (nextStatus === 'REFUNDED' && !window.confirm('Submit the Razorpay refund for this return?')) return;

    setBusyId(item.returnId);
    setError('');
    setNotice('');
    try {
      const result = await api(`/api/admin/returns/${item.returnId}`, {
        method: 'PATCH',
        body: { nextStatus, notes },
      });
      setNotice(nextStatus === 'REFUNDED' && result.refundId
        ? `Refund submitted: ${result.refundId}`
        : `Return #${item.returnId} updated to ${nextStatus}.`);
      await load();
    } catch (updateError) {
      setError(updateError.message || 'Unable to update this return.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section>
      <PageHeader title="Returns" description="Review customer requests, receive returned items and issue eligible Razorpay refunds.">
        <button type="button" onClick={load} disabled={loading} className={ghostButton}>
          <RefreshCw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} /> Refresh
        </button>
      </PageHeader>

      <div className="mb-5 flex flex-wrap gap-2">
        {FILTERS.map((value) => (
          <button key={value} type="button" onClick={() => setStatus(value)}
            aria-pressed={status === value}
            className={`rounded-lg border px-3 py-2 text-xs transition ${status === value ? 'border-white bg-white text-black' : 'border-dark-border text-light-gray hover:border-white hover:text-white'}`}>
            {value === 'all' ? 'All returns' : value}
          </button>
        ))}
      </div>

      {error ? <p role="alert" className="mb-4 rounded-lg border border-red-500/40 p-3 text-sm text-red-300">{error}</p> : null}
      {notice ? <p role="status" className="mb-4 rounded-lg border border-emerald-500/30 p-3 text-sm text-emerald-200">{notice}</p> : null}

      <div className="space-y-3">
        {returns.map((item) => (
          <article key={item.returnId} className="rounded-xl border border-dark-border bg-dark-secondary p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-white">{item.productName} · {item.size} · {item.color}</p>
                <p className="mt-1 text-xs text-light-gray">Order {item.orderNumber} · {item.quantity} unit(s)</p>
                <p className="mt-1 text-xs text-light-gray">{item.customerName} · {item.customerEmail}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-white">{item.status}</p>
                <p className="mt-1 text-xs text-light-gray">{formatDate(item.requestedAt)}</p>
              </div>
            </div>
            <p className="mt-3 text-sm text-light-gray">{item.reason}</p>
            {item.notes ? <p className="mt-2 text-xs text-light-gray">Note: {item.notes}</p> : null}
            {item.refundAmount !== null && item.refundAmount !== undefined ? (
              <p className="mt-2 text-xs text-emerald-300">Refund: ₹{Number(item.refundAmount).toFixed(2)} · {item.refundReference || 'Reference pending'}</p>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2">
              {item.status === 'REQUESTED' ? (
                <>
                  <button type="button" disabled={busyId === item.returnId} onClick={() => update(item, 'APPROVED')} className={primaryButton}>Approve</button>
                  <button type="button" disabled={busyId === item.returnId} onClick={() => update(item, 'REJECTED')} className={ghostButton}>Reject</button>
                </>
              ) : null}
              {item.status === 'APPROVED' ? (
                <button type="button" disabled={busyId === item.returnId} onClick={() => update(item, 'RECEIVED')} className={primaryButton}>Mark item received</button>
              ) : null}
              {item.status === 'RECEIVED' ? (
                <button type="button" disabled={busyId === item.returnId} onClick={() => update(item, 'REFUNDED')} className={primaryButton}>Issue Razorpay refund</button>
              ) : null}
              {busyId === item.returnId ? <span className="self-center text-xs text-light-gray">Updating…</span> : null}
            </div>
          </article>
        ))}
        {!loading && returns.length === 0 && !error ? (
          <div className="rounded-xl border border-dark-border p-10 text-center text-sm text-light-gray">No returns found for this filter.</div>
        ) : null}
        {loading ? <p className="py-8 text-center text-sm text-light-gray">Loading returns…</p> : null}
      </div>
    </section>
  );
}
