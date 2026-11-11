'use client';

import Link from 'next/link';
import { Heart, ShoppingBag } from 'lucide-react';
import ProductCard from '@/components/ProductCard';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';

export default function FavoritesPage() {
  const { favorites, favoritesLoaded } = useCart();
  const { isLoading: authLoading } = useAuth();

  if (!favoritesLoaded || authLoading) return <div className="min-h-[65vh] bg-dark pt-40 text-center text-light-gray">Loading your wishlist…</div>;

  return (
    <div className="min-h-screen bg-dark">
      <div className="mx-auto max-w-7xl px-4 pb-20 pt-32 sm:px-6 lg:px-8">
        <div className="mb-10 flex items-center gap-4">
          <Heart className="h-8 w-8 text-white" />
          <div>
            <p className="text-xs tracking-[0.3em] text-light-gray">YOUR SAVED COLLECTION</p>
            <h1 className="mt-2 text-4xl font-bold text-white">Wishlist</h1>
          </div>
        </div>
        {favorites.length === 0 ? (
          <div className="rounded-2xl border border-dark-border bg-dark-secondary p-12 text-center">
            <ShoppingBag className="mx-auto mb-4 h-12 w-12 text-light-gray" />
            <h2 className="text-2xl font-semibold text-white">Your wishlist is empty</h2>
            <p className="mt-2 text-sm text-light-gray">Save products you want to come back to later.</p>
            <Link href="/products" className="mt-6 inline-block rounded-lg bg-white px-6 py-3 font-semibold text-black">Explore products</Link>
          </div>
        ) : (
          <>
            <p className="mb-6 text-sm text-light-gray">{favorites.length} saved product(s)</p>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {favorites.map((product, index) => <ProductCard key={product.id} product={product} index={index} />)}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
