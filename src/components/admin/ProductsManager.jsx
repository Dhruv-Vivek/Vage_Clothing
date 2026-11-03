'use client';

import { useCallback, useEffect, useState } from 'react';
import { Archive, Pencil, Plus, Search } from 'lucide-react';
import { inr } from '@/lib/format';
import {
  Pager,
  PageHeader,
  StatusBadge,
  StockBadge,
  Thumb,
  api,
  ghostButton,
  inputClass,
  primaryButton,
  useDebounced,
  useToast,
} from './ui';
import ProductDrawer from './ProductDrawer';

const TABS = [
  ['all', 'All'],
  ['ACTIVE', 'Active'],
  ['DRAFT', 'Drafts'],
  ['ARCHIVED', 'Archived'],
];

export default function ProductsManager() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);
  const [categories, setCategories] = useState([]);
  const [drawer, setDrawer] = useState(null); // null | { id: number | null }
  const { toast, notify } = useToast();
  const q = useDebounced(search);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({ status, page: String(page) });
      if (q) params.set('q', q);
      if (category) params.set('category', category);
      setData(await api(`/api/admin/products?${params}`));
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }, [q, status, category, page]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    api('/api/categories')
      .then((payload) => setCategories(payload.categories || []))
      .catch(() => {});
  }, []);

  const archive = async (product) => {
    if (!window.confirm(`Archive "${product.name}"? It disappears from the store but order history is kept.`)) return;
    try {
      await api(`/api/admin/products/${product.id}`, { method: 'DELETE' });
      notify('Product archived');
      load();
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const closeDrawer = useCallback(() => setDrawer(null), []);
  const products = data?.products ?? [];
  const threshold = data?.lowStockThreshold ?? 5;

  return (
    <>
      <PageHeader title="Products" description="Everything in your catalogue. Only Active products appear in the store.">
        <button className={primaryButton} onClick={() => setDrawer({ id: null })}>
          <Plus className="h-4 w-4" /> New product
        </button>
      </PageHeader>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div role="tablist" aria-label="Filter by status" className="flex rounded-lg border border-dark-border p-0.5">
          {TABS.map(([value, label]) => {
            const count = data ? (value === 'all' ? Object.values(data.counts).reduce((a, b) => a + b, 0) : data.counts[value]) : null;
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
                {label}
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
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Search name, brand or SKU"
            aria-label="Search products"
            className={`${inputClass} pl-9`}
          />
        </div>

        <select
          value={category}
          onChange={(event) => {
            setCategory(event.target.value);
            setPage(1);
          }}
          aria-label="Filter by category"
          className={`${inputClass} w-auto`}
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {error ? (
        <p role="alert" className="mb-4 rounded-lg border border-red-500/40 px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-dark-border">
        <table className="w-full min-w-[44rem] text-left text-sm">
          <thead className="border-b border-dark-border text-light-gray">
            <tr>
              <th className="px-4 py-3 font-normal">Product</th>
              <th className="px-4 py-3 font-normal">Category</th>
              <th className="px-4 py-3 font-normal">Price</th>
              <th className="px-4 py-3 font-normal">Stock</th>
              <th className="px-4 py-3 font-normal">Status</th>
              <th className="px-4 py-3 font-normal">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {!data && !error ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-light-gray">
                  Loading products…
                </td>
              </tr>
            ) : null}
            {data && products.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-light-gray">
                  No products match. Try another filter, or add a new product.
                </td>
              </tr>
            ) : null}
            {products.map((product) => (
              <tr key={product.id} className="border-b border-dark-border last:border-0 hover:bg-dark-secondary/50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Thumb src={product.imageUrl} alt="" />
                    <div className="min-w-0">
                      <button onClick={() => setDrawer({ id: product.id })} className="block max-w-[16rem] truncate text-left font-medium hover:underline">
                        {product.name}
                      </button>
                      <span className="text-xs text-light-gray">
                        {product.brand} · {product.variantCount} variant{product.variantCount === 1 ? '' : 's'}
                      </span>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-lighter-gray">{product.category}</td>
                <td className="px-4 py-3">{inr(product.basePrice, 2)}</td>
                <td className="px-4 py-3">
                  {product.variantCount === 0 ? (
                    <span className="text-light-gray">No variants</span>
                  ) : (
                    <>
                      <StockBadge stock={product.totalStock} threshold={threshold} />
                      {product.lowVariants > 0 && product.totalStock > threshold ? (
                        <span className="block text-xs text-amber-400">{product.lowVariants} size/colour low</span>
                      ) : null}
                    </>
                  )}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={product.status} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <button className={ghostButton} onClick={() => setDrawer({ id: product.id })} aria-label={`Edit ${product.name}`}>
                      <Pencil className="h-4 w-4" />
                    </button>
                    {product.status !== 'ARCHIVED' ? (
                      <button className={ghostButton} onClick={() => archive(product)} aria-label={`Archive ${product.name}`}>
                        <Archive className="h-4 w-4" />
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pager pagination={data?.pagination} onPage={setPage} />

      <ProductDrawer
        open={drawer !== null}
        productId={drawer?.id ?? null}
        categories={categories}
        onClose={closeDrawer}
        onSaved={(message) => {
          notify(message);
          load();
        }}
      />
      {toast}
    </>
  );
}
