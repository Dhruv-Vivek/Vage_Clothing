'use client';

import { useCallback, useEffect, useState } from 'react';
import { Activity, BarChart3, Eye, RefreshCw, Search, ShoppingCart, Users } from 'lucide-react';

const fmt = (value) => Number(value || 0).toLocaleString('en-IN');
const rate = (value, total) => total > 0 ? Math.round((value / total) * 100) : 0;

function Stat({ icon: Icon, label, value, detail }) {
  return (
    <div className="rounded-xl border border-dark-border bg-dark-secondary p-4">
      <div className="flex items-center justify-between text-light-gray">
        <span className="text-sm">{label}</span>
        <Icon className="h-4 w-4" />
      </div>
      <p className="mt-3 text-3xl font-semibold text-white">{fmt(value)}</p>
      {detail ? <p className="mt-1 text-xs text-light-gray">{detail}</p> : null}
    </div>
  );
}

function Empty({ children }) {
  return <p className="rounded-lg border border-dashed border-dark-border px-4 py-8 text-center text-sm text-light-gray">{children}</p>;
}

function MetricBar({ label, value, max, note }) {
  const width = Math.max(2, Math.min(100, max ? (Number(value || 0) / max) * 100 : 0));
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="min-w-0 truncate text-white">{label}</span>
        <span className="shrink-0 tabular-nums text-light-gray">{fmt(value)}{note ? ' · ' + note : ''}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-dark-border">
        <div className="h-full rounded-full bg-white" style={{ width: width + '%' }} />
      </div>
    </div>
  );
}

export default function ProductIntelligenceDashboard() {
  const [days, setDays] = useState(30);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/admin/product-intelligence?days=' + days, {
        credentials: 'same-origin',
        cache: 'no-store',
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'Unable to load product intelligence.');
      setReport(body);
    } catch (loadError) {
      setReport(null);
      setError(loadError.message || 'Unable to load product intelligence.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [days]);

  useEffect(() => { load(); }, [load]);

  const summary = report?.summary || {};
  const maxViews = Math.max(1, ...(report?.popularProducts || []).map((item) => Number(item.views || 0)));
  const maxCategories = Math.max(1, ...(report?.categoryTrends || []).map((item) => Number(item.productViews || 0)));
  const maxSearches = Math.max(1, ...(report?.topSearches || []).map((item) => Number(item.searches || 0)));
  const maxDaily = Math.max(1, ...(report?.dailyTrend || []).map((item) => Number(item.events || 0)));

  return (
    <>
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-xs uppercase tracking-[0.25em] text-light-gray">MongoDB · Product Intelligence</p>
          <h1 className="text-2xl font-semibold tracking-tight">Product intelligence</h1>
          <p className="mt-1 max-w-2xl text-sm text-light-gray">Understand what customers view, search, browse and add to their carts.</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={days} onChange={(event) => setDays(Number(event.target.value))} aria-label="Analytics period" className="rounded-lg border border-dark-border bg-dark-secondary px-3 py-2 text-sm text-white">
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
          <button type="button" onClick={() => load(true)} disabled={loading || refreshing} className="inline-flex items-center gap-2 rounded-lg border border-dark-border px-3 py-2 text-sm text-white hover:border-white disabled:opacity-50">
            <RefreshCw className={'h-4 w-4 ' + (refreshing ? 'animate-spin' : '')} />
            Refresh
          </button>
        </div>
      </header>

      {error ? (
        <div role="alert" className="mb-6 rounded-xl border border-amber-500/40 bg-amber-500/10 p-5">
          <p className="font-medium text-amber-100">Product intelligence is unavailable</p>
          <p className="mt-1 text-sm text-amber-100/80">{error}</p>
          <p className="mt-2 text-xs text-amber-100/70">Configure MONGODB_URI and PRODUCT_INTELLIGENCE_ENABLED in the server-side .env.local, then restart Next.js.</p>
        </div>
      ) : null}

      {loading && !report ? <div className="rounded-xl border border-dark-border p-10 text-center text-sm text-light-gray">Loading MongoDB analytics…</div> : null}

      {report ? (
        <>
          <dl className="mb-8 grid grid-cols-2 gap-3 xl:grid-cols-4">
            <Stat icon={Activity} label="Tracked events" value={summary.totalEvents} detail="All recorded activity" />
            <Stat icon={Users} label="Unique visitors" value={summary.uniqueVisitors} detail="Accounts and anonymous visitors" />
            <Stat icon={Eye} label="Product views" value={summary.productViews} detail="Product detail page views" />
            <Stat icon={Search} label="Searches" value={summary.searches} detail="Privacy-filtered search terms" />
            <Stat icon={ShoppingCart} label="Add to cart" value={summary.addToCart} detail={rate(summary.addToCart, summary.productViews) + '% of product views'} />
            <Stat icon={BarChart3} label="Browse events" value={summary.browseEvents} detail="Product lists and category browsing" />
            <Stat icon={Activity} label="Cart views" value={summary.cartViews} />
            <Stat icon={ShoppingCart} label="Cart removals" value={summary.removals} />
          </dl>

          <div className="mb-6 grid gap-6 xl:grid-cols-2">
            <section className="rounded-xl border border-dark-border p-5">
              <h2 className="font-semibold">Popular products</h2>
              <p className="mb-5 mt-1 text-xs text-light-gray">Ranked by add-to-cart events, then product views.</p>
              {report.popularProducts.length ? (
                <div className="space-y-5">
                  {report.popularProducts.map((item) => (
                    <div key={item.productId}>
                      <MetricBar label={item.productName || ('Product #' + item.productId)} value={item.views} max={maxViews} note={fmt(item.addToCart) + ' adds'} />
                      <p className="mt-2 text-xs text-light-gray">{item.categoryName || 'Uncategorised'} · {fmt(item.unitsAdded)} units added</p>
                    </div>
                  ))}
                </div>
              ) : <Empty>No product views or add-to-cart activity yet.</Empty>}
            </section>

            <section className="rounded-xl border border-dark-border p-5">
              <h2 className="font-semibold">Category trends</h2>
              <p className="mb-5 mt-1 text-xs text-light-gray">Category browsing, product views and cart additions.</p>
              {report.categoryTrends.length ? (
                <div className="space-y-5">
                  {report.categoryTrends.map((item) => (
                    <div key={item.categoryId}>
                      <MetricBar label={item.categoryName || ('Category #' + item.categoryId)} value={item.productViews} max={maxCategories} note={fmt(item.addToCart) + ' adds'} />
                      <p className="mt-2 text-xs text-light-gray">{fmt(item.categoryBrowses)} category visits · {fmt(item.listViews)} listing views</p>
                    </div>
                  ))}
                </div>
              ) : <Empty>No category activity yet.</Empty>}
            </section>
          </div>

          <div className="mb-6 grid gap-6 xl:grid-cols-2">
            <section className="rounded-xl border border-dark-border p-5">
              <h2 className="font-semibold">Top searches</h2>
              <p className="mb-5 mt-1 text-xs text-light-gray">Email and phone-like patterns are redacted.</p>
              {report.topSearches.length ? (
                <div className="space-y-4">
                  {report.topSearches.map((item) => <MetricBar key={item.searchTerm} label={item.searchTerm} value={item.searches} max={maxSearches} note={fmt(item.uniqueVisitors) + ' visitors'} />)}
                </div>
              ) : <Empty>No searches recorded yet.</Empty>}
            </section>

            <section className="rounded-xl border border-dark-border p-5">
              <h2 className="font-semibold">Event mix</h2>
              <p className="mb-5 mt-1 text-xs text-light-gray">Activity distribution for this period.</p>
              {report.eventTypes.length ? (
                <div className="space-y-3">
                  {report.eventTypes.map((item) => (
                    <div key={item.eventType} className="flex items-center justify-between gap-3 border-b border-dark-border pb-2 text-sm last:border-0">
                      <span className="text-light-gray">{item.eventType.replaceAll('_', ' ')}</span>
                      <span className="font-medium tabular-nums text-white">{fmt(item.count)}</span>
                    </div>
                  ))}
                </div>
              ) : <Empty>No events recorded yet.</Empty>}
            </section>
          </div>

          <section className="rounded-xl border border-dark-border p-5">
            <h2 className="font-semibold">Daily activity</h2>
            <p className="mb-5 mt-1 text-xs text-light-gray">Events recorded each day in India Standard Time.</p>
            {report.dailyTrend.length ? (
              <div className="flex h-44 items-end gap-1 overflow-x-auto pb-6">
                {report.dailyTrend.map((item) => {
                  const height = Math.max(3, (Number(item.events || 0) / maxDaily) * 100);
                  return (
                    <div key={item.date} className="group flex h-full min-w-5 flex-1 flex-col justify-end">
                      <div className="relative flex-1" title={item.date + ': ' + fmt(item.events) + ' events'}>
                        <div className="absolute bottom-0 w-full rounded-t bg-white/80 transition-colors group-hover:bg-white" style={{ height: height + '%' }} />
                      </div>
                      <span className="mt-2 -rotate-45 origin-top-left whitespace-nowrap text-[9px] text-light-gray">{item.date.slice(5)}</span>
                    </div>
                  );
                })}
              </div>
            ) : <Empty>No daily activity recorded yet.</Empty>}
          </section>

          <p className="mt-5 text-right text-xs text-light-gray">Period: {report.periodDays} days · Generated {new Date(report.generatedAt).toLocaleString('en-IN')}</p>
        </>
      ) : null}
    </>
  );
}
