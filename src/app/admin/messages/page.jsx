'use client';

import { useEffect, useState } from 'react';
import { Mail, RefreshCw, Search } from 'lucide-react';
import AdminShell from '@/components/admin/AdminShell';

function DeliveryStatus({ label, status, error }) {
  const color = status === 'SENT' ? 'text-emerald-300' : status === 'FAILED' ? 'text-red-300' : 'text-amber-200';
  return (
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-[0.12em] text-white/35">{label}</p>
      <p className={`mt-1 text-xs font-medium ${color}`}>{status}</p>
      {error && <p className="mt-1 break-words text-[11px] text-red-200/70">{error}</p>}
    </div>
  );
}

const inputClass = 'w-full rounded-lg border border-white/10 bg-[#111] py-2.5 pl-9 pr-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-white/40';

export default function AdminMessagesPage() {
  const [messages, setMessages] = useState([]);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async (page = 1) => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: '20' });
      if (query) params.set('q', query);
      const response = await fetch('/api/admin/messages?' + params.toString(), { credentials: 'same-origin', cache: 'no-store' });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Unable to load contact messages.');
      setMessages(result.messages || []);
      setPagination(result.pagination || { page: 1, pageSize: 20, total: 0, totalPages: 1 });
    } catch (loadError) {
      setError(loadError.message || 'Unable to load contact messages.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(1); }, [query]);

  return (
    <AdminShell title="Contact inbox" description="Review messages sent through the VAGE Contact Us form and inspect both email delivery attempts.">
      <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-white/10 bg-[#151515] p-4 sm:flex-row">
        <form onSubmit={(event) => { event.preventDefault(); setQuery(search.trim()); }} className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search sender, email or subject" className={inputClass} />
        </form>
        <button onClick={() => load(1)} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 px-4 py-2.5 text-sm text-white/65 hover:border-white/30 hover:text-white disabled:opacity-40"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh</button>
      </div>

      {error && <div className="mb-4 rounded-xl border border-red-400/20 bg-red-400/5 p-4 text-sm text-red-200">{error}</div>}

      <div className="mb-4 flex items-center justify-between text-xs text-white/40"><span>{pagination.total} message(s)</span><span>Page {pagination.page} of {pagination.totalPages}</span></div>

      <div className="space-y-4">
        {messages.map((item) => (
          <article key={item.contact_message_id} className="rounded-2xl border border-white/10 bg-[#151515] p-5 sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-white/35">#{item.contact_message_id}</span>
                  <span className="rounded-full border border-white/10 px-2 py-1 text-[10px] text-white/45">{new Date(item.created_at).toLocaleString('en-IN')}</span>
                </div>
                <h2 className="mt-3 text-lg font-semibold">{item.subject}</h2>
                <p className="mt-1 text-sm text-white/65">{item.full_name} · <a className="underline decoration-white/25 underline-offset-4 hover:text-white" href={'mailto:' + encodeURIComponent(item.email)}>{item.email}</a>{item.phone ? ' · ' + item.phone : ''}</p>
              </div>
              <a href={'mailto:' + encodeURIComponent(item.email) + '?subject=' + encodeURIComponent('Re: ' + item.subject)} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-white/15 px-4 py-2.5 text-xs text-white/75 transition hover:border-white/40 hover:text-white"><Mail className="h-4 w-4" /> Reply by email</a>
            </div>
            <div className="mt-5 whitespace-pre-wrap rounded-xl border border-white/[0.07] bg-black/30 p-4 text-sm leading-7 text-white/75">{item.message}</div>
            <div className="mt-5 grid gap-4 border-t border-white/[0.07] pt-4 sm:grid-cols-2">
              <DeliveryStatus label="VAGE notification" status={item.notification_status} error={item.notification_last_error} />
              <DeliveryStatus label="Customer acknowledgement" status={item.acknowledgement_status} error={item.acknowledgement_last_error} />
            </div>
          </article>
        ))}
        {!loading && messages.length === 0 && <div className="rounded-2xl border border-white/10 bg-[#151515] px-5 py-14 text-center text-sm text-white/40">No contact messages found.</div>}
        {loading && <div className="rounded-2xl border border-white/10 bg-[#151515] px-5 py-14 text-center text-sm text-white/40">Loading messages…</div>}
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <button onClick={() => load(Math.max(1, pagination.page - 1))} disabled={loading || pagination.page <= 1} className="rounded-lg border border-white/10 px-4 py-2 text-xs text-white/65 hover:text-white disabled:opacity-30">Previous</button>
        <button onClick={() => load(Math.min(pagination.totalPages, pagination.page + 1))} disabled={loading || pagination.page >= pagination.totalPages} className="rounded-lg border border-white/10 px-4 py-2 text-xs text-white/65 hover:text-white disabled:opacity-30">Next</button>
      </div>
    </AdminShell>
  );
}
