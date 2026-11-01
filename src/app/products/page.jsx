'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import ProductCard from '@/components/ProductCard';

function ProductsContent() {
  const searchParams = useSearchParams();
  const searchQuery = searchParams.get('q') || '';

  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState('All');
  const [sort, setSort] = useState('newest');
  const [minPriceInput, setMinPriceInput] = useState('');
  const [maxPriceInput, setMaxPriceInput] = useState('');
  const [appliedMinPrice, setAppliedMinPrice] = useState('');
  const [appliedMaxPrice, setAppliedMaxPrice] = useState('');
  const [inStockOnly, setInStockOnly] = useState(false);
  const [products, setProducts] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadCategories() {
      setLoadingCategories(true);
      try {
        const response = await fetch('/api/categories', { cache: 'no-store' });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || 'Unable to load categories.');
        if (!cancelled) setCategories(body.categories || []);
      } catch (loadError) {
        if (!cancelled) setError(loadError.message);
      } finally {
        if (!cancelled) setLoadingCategories(false);
      }
    }

    loadCategories();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    setPage(1);
  }, [activeCategory, searchQuery, sort, appliedMinPrice, appliedMaxPrice, inStockOnly]);

  useEffect(() => {
    let cancelled = false;

    async function loadProducts() {
      setLoadingProducts(true);
      setError('');

      const params = new URLSearchParams({
        page: String(page),
        limit: '24',
        sort,
      });
      if (activeCategory !== 'All') params.set('category', activeCategory);
      if (searchQuery) params.set('q', searchQuery);
      if (appliedMinPrice !== '') params.set('minPrice', appliedMinPrice);
      if (appliedMaxPrice !== '') params.set('maxPrice', appliedMaxPrice);
      if (inStockOnly) params.set('inStock', '1');

      try {
        const response = await fetch(`/api/products?${params.toString()}`, { cache: 'no-store' });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || 'Unable to load products.');
        if (cancelled) return;

        setProducts((current) => page === 1 ? (body.products || []) : [...current, ...(body.products || [])]);
        setPagination(body.pagination || null);
      } catch (loadError) {
        if (!cancelled) setError(loadError.message);
      } finally {
        if (!cancelled) setLoadingProducts(false);
      }
    }

    loadProducts();
    return () => { cancelled = true; };
  }, [activeCategory, searchQuery, sort, page, appliedMinPrice, appliedMaxPrice, inStockOnly]);

  const categoryButtons = useMemo(() => [
    { id: 'All', name: 'All' },
    ...categories.map((category) => ({ id: category.slug, name: category.name })),
  ], [categories]);

  return (
    <div className="bg-dark">
      <section className="pt-32 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-5xl md:text-6xl font-bold text-white mb-4 tracking-tight"
            style={{ fontFamily: 'serif' }}
          >
            𝔒𝔲𝔯  ℭ𝔬𝔩𝔩𝔢𝔠𝔱𝔦𝔬𝔫
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-lg text-light-gray max-w-2xl mx-auto"
          >
            Handpicked pieces that embody the spirit of contemporary fashion
          </motion.p>
          {searchQuery && (
            <p className="mt-4 text-sm text-light-gray">
              Showing results for <span className="text-white">“{searchQuery}”</span>
            </p>
          )}
        </div>
      </section>

      <section className="pb-10 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex flex-wrap items-center justify-center gap-4"
          >
            {categoryButtons.map((category) => (
              <button
                key={category.id}
                onClick={() => setActiveCategory(category.id)}
                className={`px-6 py-3 rounded-full text-sm font-medium transition-all duration-300 ${
                  activeCategory === category.id
                    ? 'bg-white text-black'
                    : 'bg-dark-secondary text-white hover:bg-dark-border'
                }`}
              >
                {category.name}
              </button>
            ))}
          </motion.div>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
            <label className="flex items-center gap-3 text-sm text-light-gray">
              <span>Sort by</span>
              <select
                value={sort}
                onChange={(event) => setSort(event.target.value)}
                className="bg-dark-secondary border border-dark-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-lighter-gray"
              >
                <option value="newest">Newest</option>
                <option value="price_asc">Price: Low to High</option>
                <option value="price_desc">Price: High to Low</option>
                <option value="name">Name</option>
              </select>
            </label>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                setAppliedMinPrice(minPriceInput.trim());
                setAppliedMaxPrice(maxPriceInput.trim());
                setPage(1);
              }}
              className="flex flex-wrap items-center justify-center gap-2"
            >
              <input
                type="number"
                min="0"
                max="1000000"
                value={minPriceInput}
                onChange={(event) => setMinPriceInput(event.target.value)}
                placeholder="Min ₹"
                aria-label="Minimum price"
                className="w-24 bg-dark-secondary border border-dark-border rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-lighter-gray"
              />
              <input
                type="number"
                min="0"
                max="1000000"
                value={maxPriceInput}
                onChange={(event) => setMaxPriceInput(event.target.value)}
                placeholder="Max ₹"
                aria-label="Maximum price"
                className="w-24 bg-dark-secondary border border-dark-border rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-lighter-gray"
              />
              <button type="submit" className="px-4 py-2 rounded-lg bg-dark-secondary border border-dark-border text-sm text-white hover:border-white transition-colors">
                Apply price
              </button>
            </form>
            <label className="flex items-center gap-2 text-sm text-light-gray">
              <input type="checkbox" checked={inStockOnly} onChange={(event) => { setInStockOnly(event.target.checked); setPage(1); }} />
              In stock only
            </label>
          </div>
          {loadingCategories && <p className="text-center text-xs text-light-gray mt-4">Loading categories…</p>}
        </div>
      </section>

      <section className="pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {error && (
            <div className="text-center py-6 text-red-300" role="alert">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {products.map((product, index) => (
              <ProductCard key={product.id} product={product} index={index} />
            ))}
          </div>

          {loadingProducts && (
            <p className="text-center text-light-gray py-12">Loading Vage collection…</p>
          )}

          {!loadingProducts && !error && products.length === 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-20">
              <p className="text-2xl text-light-gray">No products found in this category</p>
            </motion.div>
          )}

          {!loadingProducts && pagination?.hasNextPage && (
            <div className="flex justify-center mt-12">
              <button
                onClick={() => setPage((current) => current + 1)}
                className="px-8 py-3 rounded-lg bg-dark-secondary border border-dark-border text-white hover:border-white transition-all"
              >
                Load more products
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function ProductsFallback() {
  return <div className="min-h-screen bg-dark pt-40 text-center text-light-gray">Loading Vage collection…</div>;
}

export default function ProductsPage() {
  return (
    <Suspense fallback={<ProductsFallback />}>
      <ProductsContent />
    </Suspense>
  );
}
