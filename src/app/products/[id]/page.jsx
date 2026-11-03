'use client';

import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ShoppingCart, Heart, ArrowLeft, Minus, Plus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useCart } from '@/context/CartContext';

function formatPrice(value) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function ProductDetail() {
  const { id } = useParams();
  const router = useRouter();
  const { addToCart, toggleFavorite, isFavorite } = useCart();
  const [product, setProduct] = useState(null);
  const [variants, setVariants] = useState([]);
  const [selectedVariantId, setSelectedVariantId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [isAdded, setIsAdded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();

    async function loadProduct() {
      setLoading(true);
      setError('');
      try {
        const response = await fetch(`/api/products/${encodeURIComponent(id)}`, {
          cache: 'no-store',
          signal: controller.signal,
        });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || 'Product not found.');
        const loadedVariants = body.variants || [];
        setProduct(body.product);
        setVariants(loadedVariants);
        const firstAvailable = loadedVariants.find((variant) => Number(variant.stockQuantity) > 0);
        setSelectedVariantId(String((firstAvailable || loadedVariants[0])?.variantId || ''));
        setQuantity(1);
      } catch (loadError) {
        if (loadError.name !== 'AbortError') setError(loadError.message);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    loadProduct();
    return () => controller.abort();
  }, [id]);

  useEffect(() => {
    if (!isAdded) return undefined;
    const timeout = setTimeout(() => setIsAdded(false), 2000);
    return () => clearTimeout(timeout);
  }, [isAdded]);

  const selectedVariant = useMemo(
    () => variants.find((variant) => String(variant.variantId) === String(selectedVariantId)) || null,
    [variants, selectedVariantId]
  );

  if (loading) {
    return <div className="min-h-screen bg-dark flex items-center justify-center text-light-gray">Loading product…</div>;
  }

  if (error || !product) {
    return (
      <div className="min-h-screen bg-dark flex items-center justify-center px-4">
        <div className="text-center">
          <h1 className="text-4xl text-white mb-4">Product Not Found</h1>
          <p className="text-light-gray mb-6">{error || 'This product is unavailable.'}</p>
          <button onClick={() => router.push('/products')} className="px-6 py-3 bg-white text-black rounded-lg">
            Back to Products
          </button>
        </div>
      </div>
    );
  }

  const isLiked = isFavorite(product.id);
  const maxStock = Number(selectedVariant?.stockQuantity || 0);
  const canAddToCart = Boolean(selectedVariant && maxStock > 0);

  const handleAddToCart = () => {
    if (!canAddToCart) return;
    if (addToCart(product, selectedVariant, quantity)) setIsAdded(true);
  };

  return (
    <div className="bg-dark">
      <div className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <motion.button
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            onClick={() => router.back()}
            className="flex items-center gap-2 text-light-gray hover:text-white transition-colors mb-8"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back</span>
          </motion.button>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              className="relative aspect-square rounded-2xl overflow-hidden bg-dark-secondary"
            >
              <img
                src={product.image || '/products/urban-tee.jpg'}
                alt={product.name}
                className="w-full h-full object-cover"
              />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              className="space-y-6"
            >
              <p className="text-light-gray text-sm uppercase tracking-wider">{product.category}</p>
              <h1 className="text-4xl md:text-5xl font-bold text-white">{product.name}</h1>
              <div className="text-4xl font-bold text-white">
                {formatPrice(selectedVariant?.unitPrice ?? product.basePrice)}
              </div>
              <p className="text-light-gray text-lg leading-relaxed">
                {product.description || 'Premium quality product crafted with attention to detail.'}
              </p>

              <div className="grid grid-cols-3 gap-4 py-6 border-y border-dark-border">
                <div>
                  <p className="text-sm text-light-gray mb-1">Material</p>
                  <p className="text-white font-medium">{product.specs?.material || 'Not specified'}</p>
                </div>
                <div>
                  <p className="text-sm text-light-gray mb-1">Fit</p>
                  <p className="text-white font-medium">{product.specs?.fit || 'Not specified'}</p>
                </div>
                <div>
                  <p className="text-sm text-light-gray mb-1">Origin</p>
                  <p className="text-white font-medium">{product.specs?.origin || 'Not specified'}</p>
                </div>
              </div>

              <div className="flex items-center justify-between gap-4">
                <p className="text-sm text-light-gray">
                  {canAddToCart ? `${maxStock} units available for this variant` : 'This variant is currently out of stock'}
                </p>
                <p className="text-sm text-light-gray">{variants.length} variants</p>
              </div>

              <div className="space-y-2 py-4 border-b border-dark-border">
                <label htmlFor="product-variant" className="block text-white font-medium">
                  Select size and colour
                </label>
                <select
                  id="product-variant"
                  value={selectedVariantId}
                  onChange={(event) => {
                    setSelectedVariantId(event.target.value);
                    setQuantity(1);
                    setIsAdded(false);
                  }}
                  disabled={variants.length === 0}
                  className="w-full px-4 py-3 bg-dark-secondary border border-dark-border rounded-lg text-white focus:outline-none focus:border-white disabled:opacity-50"
                >
                  {variants.length === 0 && <option value="">No variants available</option>}
                  {variants.map((variant) => (
                    <option key={variant.variantId} value={String(variant.variantId)} disabled={Number(variant.stockQuantity) <= 0}>
                      {variant.size} / {variant.color} — {formatPrice(variant.unitPrice)} ({variant.stockQuantity > 0 ? `${variant.stockQuantity} in stock` : 'Out of stock'})
                    </option>
                  ))}
                </select>
                {selectedVariant && (
                  <p className="text-light-gray text-xs">
                    SKU: {selectedVariant.sku} · Variant ID: {selectedVariant.variantId}
                  </p>
                )}
              </div>

              <div className="space-y-3">
                <label className="text-white font-medium">Quantity</label>
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setQuantity((current) => Math.max(1, current - 1))}
                    disabled={!canAddToCart || quantity <= 1}
                    className="w-10 h-10 rounded-lg bg-dark-secondary border border-dark-border flex items-center justify-center hover:border-white transition-colors disabled:opacity-40"
                  >
                    <Minus className="w-4 h-4 text-white" />
                  </button>
                  <span className="text-2xl font-bold text-white w-12 text-center">{quantity}</span>
                  <button
                    onClick={() => setQuantity((current) => Math.min(maxStock, current + 1))}
                    disabled={!canAddToCart || quantity >= maxStock}
                    className="w-10 h-10 rounded-lg bg-dark-secondary border border-dark-border flex items-center justify-center hover:border-white transition-colors disabled:opacity-40"
                  >
                    <Plus className="w-4 h-4 text-white" />
                  </button>
                </div>
              </div>

              <div className="flex gap-4">
                <motion.button
                  whileHover={canAddToCart ? { scale: 1.02 } : undefined}
                  whileTap={canAddToCart ? { scale: 0.98 } : undefined}
                  onClick={handleAddToCart}
                  disabled={!canAddToCart}
                  className={`flex-1 px-8 py-4 rounded-lg font-medium transition-all duration-300 flex items-center justify-center gap-2 ${
                    isAdded ? 'bg-green-500 text-white' : 'bg-white text-black hover:bg-lighter-gray disabled:bg-dark-secondary disabled:text-light-gray'
                  }`}
                >
                  <ShoppingCart className="w-5 h-5" />
                  <span>{isAdded ? 'Added to Cart!' : canAddToCart ? 'Add to Cart' : 'Out of Stock'}</span>
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => toggleFavorite(product)}
                  className="w-14 h-14 rounded-lg bg-dark-secondary border border-dark-border flex items-center justify-center hover:border-white transition-colors"
                >
                  <Heart className={`w-6 h-6 transition-colors ${isLiked ? 'fill-red-500 text-red-500' : 'text-white'}`} />
                </motion.button>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ProductDetail;
