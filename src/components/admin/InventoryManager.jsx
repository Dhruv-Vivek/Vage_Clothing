'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, Search } from 'lucide-react';
import {
  Pager,
  PageHeader,
  StockBadge,
  Thumb,
  api,
  inputClass,
  primaryButton,
  useDebounced,
  useToast,
} from './ui';

const FILTERS = [
  ['all', 'All'],
  ['low', 'Low or out'],
  ['out', 'Out of stock'],
];

function StockRow({ item, threshold, onSaved, notify }) {
  const [value, setValue] = useState(String(item.stock));
  const [saving, setSaving] = useState(false);
  useEffect(() => setValue(String(item.stock)), [item.stock]);

  const changed = value.trim() !== '' && Number(value) !== item.stock;

  const save = async () => {
    setSaving(true);
    try {
      await api(`/api/admin/inventory/${item.variantId}`, { method: 'PATCH', body: { stock: Number(value) } });
      notify(`${item.productName} (${item.size}, ${item.color}): stock set to ${Number(value)}`);
      onSaved();
    } catch (err) {
      notify(err.message, 'error');
      setValue(String(item.stock));
    } finally {
      setSaving(false);
    }
  };

  return (
    <tr className="border-b border-dark-border last:border-0 hover:bg-dark-secondary/50">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <Thumb src={item.imageUrl} alt="" />
          <div className="min-w-0">
            <span className="block max-w-[16rem] truncate font-medium">{item.productName}</span>
            <span className="text-xs text-light-gray">
              {item.size} · {item.color}
              {item.productStatus === 'DRAFT' ? ' · Draft' : ''}
            </span>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 font-mono text-xs text-light-gray">{item.sku}</td>
      <td className="px-4 py-3">
        <StockBadge stock={item.stock} threshold={threshold} />
      </td>
      <td className="px-4 py-3">
        <form
          className="flex items-center justify-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (changed && !saving) save();
          }}
        >
          <input
            type="number"
            min="0"
            max="1000000"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            aria-label={`Stock for ${item.productName}, ${item.size}, ${item.color}`}
            className={`${inputClass} w-24 text-right`}
          />
          <button type="submit" className={primaryButton} disabled={!changed || saving} aria-label="Save stock">
            <Check className="h-4 w-4" />
          </button>
        </form>
      </td>
    </tr>
  );
}

export default function InventoryManager() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1);
  const { toast, notify } = useToast();
  const q = useDebounced(search);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({ filter, page: String(page) });
      if (q) params.set('q', q);
      setData(await api(`/api/admin/inventory?${params}`));
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }, [q, filter, page]);

  useEffect(() => {
    load();
  }, [load]);

  const summary = data?.summary;
  const threshold = data?.threshold ?? 5;

  return (
    <>
      <PageHeader
        title="Inventory"
        description={`Set the stock for each size and colour. Anything at ${threshold} or fewer counts as low. Every change is recorded in the inventory log.`}
      />

      {summary ? (
        <dl className="mb-6 grid grid-cols-2 divide-x divide-dark-border overflow-hidden rounded-xl border border-dark-border sm:grid-cols-4">
          {[
            ['Variants tracked', summary.variants, ''],
            ['Units in stock', summary.units.toLocaleString('en-IN'), ''],
            ['Low stock', summary.lowStock, summary.lowStock > 0 ? 'text-amber-400' : ''],
            ['Out of stock', summary.outOfStock, summary.outOfStock > 0 ? 'text-red-400' : ''],
          ].map(([label, value, tone]) => (
            <div key={label} className="px-4 py-3">
              <dt className="text-xs text-light-gray">{label}</dt>
              <dd className={`mt-1 text-2xl font-semibold ${tone}`}>{value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div role="tablist" aria-label="Filter stock" className="flex rounded-lg border border-dark-border p-0.5">
          {FILTERS.map(([value, label]) => (
            <button
              key={value}
              role="tab"
              aria-selected={filter === value}
              onClick={() => {
                setFilter(value);
                setPage(1);
              }}
              className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                filter === value ? 'bg-white text-black' : 'text-light-gray hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="relative min-w-[12rem] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
          <input
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Search product, SKU, size or colour"
            aria-label="Search inventory"
            className={`${inputClass} pl-9`}
          />
        </div>
      </div>

      {error ? (
        <p role="alert" className="mb-4 rounded-lg border border-red-500/40 px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-dark-border">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead className="border-b border-dark-border text-light-gray">
            <tr>
              <th className="px-4 py-3 font-normal">Product</th>
              <th className="px-4 py-3 font-normal">SKU</th>
              <th className="px-4 py-3 font-normal">In stock</th>
              <th className="px-4 py-3 text-right font-normal">Set stock</th>
            </tr>
          </thead>
          <tbody>
            {!data && !error ? (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-light-gray">
                  Loading inventory…
                </td>
              </tr>
            ) : null}
            {data && data.items.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-light-gray">
                  {filter === 'all' && !q
                    ? 'No variants yet. Add sizes and colours to a product first.'
                    : 'Nothing matches this filter. Everything looks stocked.'}
                </td>
              </tr>
            ) : null}
            {data?.items.map((item) => (
              <StockRow key={item.variantId} item={item} threshold={threshold} onSaved={load} notify={notify} />
            ))}
          </tbody>
        </table>
      </div>

      <Pager pagination={data?.pagination} onPage={setPage} />
      {toast}
    </>
  );
}
