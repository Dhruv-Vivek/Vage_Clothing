'use client';

import { useCallback, useEffect, useState } from 'react';
import { Mail, RefreshCw, Search } from 'lucide-react';

function Status({ label, value, error }) {
  const tone = value === 'SENT' ? 'text-emerald-300' : value === 'FAILED' ? 'text-red-300' : 'text-amber-200';
  return (
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-[0.14em] text-light-gray">{label}</p>
      <p className={`mt-1 text-xs font-medium ${tone}`}>{value || 'UNKNOWN'}</p>
      {error ? <p className="mt-1 break-words text-[11px] text-red-300/80">{error}</p> : null}
    </div>
  );
}

export default function AdminMessagesPage() {
  const [messages, setMessages] = useState([]);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async (page = 1) => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: '20' });
      if (query) params.set('q', query);
      const response = await fetch(`/api/admin/messages?${params}`, {
        credentials: 'same-origin',
        cache: 'no-store',
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'Unable to load contact messages.');
      setMessages(body.messages || []);
      setPagination(body.pagination || { page: 1, pageSize: 20, total: 0, totalPages: 1 });
    } catch (loadError) {
      setError(loadError.message || 'Unable to load contact messages.');
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => { load(1); }, [load]);

  const applySearch = (event) => {
    event.preventDefault();
    setQuery(search.trim());
  };

  return (
    <section>
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-light-gray">Customer support</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Contact inbox</h1>
          <p className="mt-1 text-sm text-light-gray">Messages from the store contact form and the delivery status of both emails.</p>
        </div>
        <button type="button" onClick={() => load(pagination.page)} disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-dark-border px-3 py-2 text-sm text-white hover:border-white disabled:opacity-50">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </header>

      <form onSubmit={applySearch} className="mb-5 flex flex-col gap-3 rounded-xl border border-dark-border bg-dark-secondary p-4 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-light-gray" />
          <input value={search} onChange={(event) => setSearch(event.target.value)}
            placeholder="Search sender, email or subject"
            aria-label="Search contact messages"
            className="w-full rounded-lg border border-dark-border bg-dark py-2.5 pl-9 pr-3 text-sm text-white outline-none placeholder:text-gray-500 focus:border-white" />
        </div>
        <button type="submit" className="rounded-lg bg-white px-4 py-2.5 text-sm font-medium text-black hover:bg-lighter-gray">Search</button>
      </form>

      {error ? <p role="alert" className="mb-5 rounded-lg border border-red-500/40 px-4 py-3 text-sm text-red-300">{error}</p> : null}
      <div className="mb-4 flex items-center justify-between text-xs text-light-gray">
        <span>{pagination.total} message(s)</span>
        <span>Page {pagination.page} of {pagination.totalPages}</span>
      </div>

      <div className="space-y-4">
        {messages.map((item) => (
          <article key={item.contact_message_id} className="rounded-xl border border-dark-border bg-dark-secondary p-5 sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 text-xs text-light-gray">
                  <span>Message #{item.contact_message_id}</span>
                  <span>·</span>
                  <time dateTime={item.created_at}>{new Date(item.created_at).toLocaleString('en-IN')}</time>
                </div>
                <h2 className="mt-3 text-lg font-semibold text-white">{item.subject}</h2>
                <p className="mt-1 text-sm text-light-gray">
                  {item.full_name} · <a href={`mailto:${item.email}`} className="underline decoration-white/30 underline-offset-4 hover:text-white">{item.email}</a>
                  {item.phone ? ` · ${item.phone}` : ''}
                </p>
              </div>
              <a href={`mailto:${item.email}?subject=${encodeURIComponent('Re: ' + item.subject)}`}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-dark-border px-4 py-2.5 text-xs text-white/80 hover:border-white">
                <Mail className="h-4 w-4" /> Reply by email
              </a>
            </div>
            <div className="mt-5 whitespace-pre-wrap rounded-lg border border-dark-border bg-dark p-4 text-sm leading-7 text-light-gray">{item.message}</div>
            <div className="mt-5 grid gap-4 border-t border-dark-border pt-4 sm:grid-cols-2">
              <Status label="VAGE notification" value={item.notification_status} error={item.notification_last_error} />
              <Status label="Customer acknowledgement" value={item.acknowledgement_status} error={item.acknowledgement_last_error} />
            </div>
          </article>
        ))}
        {!loading && messages.length === 0 && !error ? (
          <div className="rounded-xl border border-dark-border p-10 text-center text-sm text-light-gray">No contact messages found.</div>
        ) : null}
        {loading ? <p className="py-8 text-center text-sm text-light-gray">Loading messages…</p> : null}
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <button type="button" onClick={() => load(Math.max(1, pagination.page - 1))}
          disabled={loading || pagination.page <= 1}
          className="rounded-lg border border-dark-border px-4 py-2 text-xs text-white disabled:opacity-30">Previous</button>
        <button type="button" onClick={() => load(Math.min(pagination.totalPages, pagination.page + 1))}
          disabled={loading || pagination.page >= pagination.totalPages}
          className="rounded-lg border border-dark-border px-4 py-2 text-xs text-white disabled:opacity-30">Next</button>
      </div>
    </section>
  );
}
