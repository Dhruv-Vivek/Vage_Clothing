'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ShoppingCart, Heart, ArrowLeft, Minus, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useCart } from '@/context/CartContext';
import { inr } from '@/lib/format';

function ProductDetail() {
  const { id } = useParams();
  const router = useRouter();
  const { addToCart, toggleFavorite, isFavorite } = useCart();
  const [product, setProduct] = useState(null);
  const [variants, setVariants] = useState([]);
  const [selectedSize, setSelectedSize] = useState('');
  const [selectedColor, setSelectedColor] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [isAdding, setIsAdding] = useState(false);
  const [isAdded, setIsAdded] = useState(false);
  const [cartError, setCartError] = useState('');
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
        const list = body.variants || [];
        setProduct(body.product);
        setVariants(list);
        setQuantity(1);
        // If there is only one size or colour there is nothing to choose, so pick it for the customer.
        const sizes = [...new Set(list.map((v) => v.size))];
        const colors = [...new Set(list.map((v) => v.color))];
        setSelectedSize(sizes.length === 1 ? sizes[0] : '');
        setSelectedColor(colors.length === 1 ? colors[0] : '');
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
    const timeout = setTimeout(() => setIsAdded(false), 2500);
    return () => clearTimeout(timeout);
  }, [isAdded]);

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
  const sizes = [...new Set(variants.map((v) => v.size))];
  const colors = [...new Set(variants.map((v) => v.color))];
  const anyInStock = variants.some((v) => v.inStock);

  const selectedVariant = variants.find((v) => v.size === selectedSize && v.color === selectedColor) || null;
  const maxStock = selectedVariant ? Math.min(selectedVariant.stockQuantity, 10) : 0;
  const canAddToCart = Boolean(selectedVariant && selectedVariant.inStock);

  // A size/colour button is available if some in-stock variant matches it (and the other choice, once made).
  const sizeAvailable = (size) =>
    variants.some((v) => v.size === size && v.inStock && (!selectedColor || v.color === selectedColor));
  const colorAvailable = (color) =>
    variants.some((v) => v.color === color && v.inStock && (!selectedSize || v.size === selectedSize));

  const chooseSize = (size) => {
    setSelectedSize(size);
    setQuantity(1);
    setCartError('');
  };
  const chooseColor = (color) => {
    setSelectedColor(color);
    setQuantity(1);
    setCartError('');
  };

  const displayPrice = selectedVariant ? inr(selectedVariant.unitPrice, 2) : product.price;

  const handleAddToCart = async () => {
    setCartError('');
    if (!selectedVariant) {
      if (selectedSize && selectedColor) setCartError('That size and colour combination is not available.');
      else if (!selectedSize && sizes.length > 1) setCartError('Please choose a size.');
      else setCartError('Please choose a colour.');
      return;
    }
    if (!canAddToCart) return;
    setIsAdding(true);
    const result = await addToCart(selectedVariant.variantId, quantity);
    setIsAdding(false);
    if (result.ok) setIsAdded(true);
    else if (!result.needsLogin) setCartError(result.error);
  };

  const optionButton = (active, available) =>
    `px-4 py-2 rounded-lg border text-sm transition-colors ${
      active
        ? 'bg-white text-black border-white'
        : available
          ? 'bg-dark-secondary text-white border-dark-border hover:border-white'
          : 'bg-dark text-gray-600 border-dark-border line-through cursor-not-allowed'
    }`;

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
              <div className="text-4xl font-bold text-white">{displayPrice}</div>
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

              {anyInStock ? (
                <div className="space-y-5">
                  <div>
                    <p className="text-sm text-light-gray mb-2">Size{selectedSize ? `: ${selectedSize}` : ''}</p>
                    <div className="flex flex-wrap gap-2" role="group" aria-label="Choose a size">
                      {sizes.map((size) => {
                        const available = sizeAvailable(size);
                        return (
                          <button
                            key={size}
                            type="button"
                            disabled={!available}
                            aria-pressed={selectedSize === size}
                            onClick={() => chooseSize(size)}
                            className={optionButton(selectedSize === size, available)}
                          >
                            {size}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <p className="text-sm text-light-gray mb-2">Colour{selectedColor ? `: ${selectedColor}` : ''}</p>
                    <div className="flex flex-wrap gap-2" role="group" aria-label="Choose a colour">
                      {colors.map((color) => {
                        const available = colorAvailable(color);
                        return (
                          <button
                            key={color}
                            type="button"
                            disabled={!available}
                            aria-pressed={selectedColor === color}
                            onClick={() => chooseColor(color)}
                            className={optionButton(selectedColor === color, available)}
                          >
                            {color}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <p className="text-sm text-light-gray">
                    {selectedVariant
                      ? selectedVariant.stockQuantity <= 5
                        ? `Only ${selectedVariant.stockQuantity} left in this size and colour`
                        : 'In stock'
                      : 'Choose a size and colour to see availability'}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-red-300">Currently out of stock</p>
              )}

              <div className="space-y-3">
                <label className="text-white font-medium">Quantity</label>
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setQuantity((current) => Math.max(1, current - 1))}
                    disabled={!canAddToCart || quantity <= 1}
                    aria-label="Decrease quantity"
                    className="w-10 h-10 rounded-lg bg-dark-secondary border border-dark-border flex items-center justify-center hover:border-white transition-colors disabled:opacity-40"
                  >
                    <Minus className="w-4 h-4 text-white" />
                  </button>
                  <span className="text-2xl font-bold text-white w-12 text-center">{quantity}</span>
                  <button
                    onClick={() => setQuantity((current) => Math.min(maxStock, current + 1))}
                    disabled={!canAddToCart || quantity >= maxStock}
                    aria-label="Increase quantity"
                    className="w-10 h-10 rounded-lg bg-dark-secondary border border-dark-border flex items-center justify-center hover:border-white transition-colors disabled:opacity-40"
                  >
                    <Plus className="w-4 h-4 text-white" />
                  </button>
                </div>
              </div>

              {cartError ? (
                <p role="alert" className="text-sm text-red-300">
                  {cartError}
                </p>
              ) : null}

              <div className="flex gap-4">
                <motion.button
                  whileHover={anyInStock ? { scale: 1.02 } : undefined}
                  whileTap={anyInStock ? { scale: 0.98 } : undefined}
                  onClick={handleAddToCart}
                  disabled={!anyInStock || isAdding}
                  className={`flex-1 px-8 py-4 rounded-lg font-medium transition-all duration-300 flex items-center justify-center gap-2 ${
                    isAdded ? 'bg-green-500 text-white' : 'bg-white text-black hover:bg-lighter-gray disabled:bg-dark-secondary disabled:text-light-gray'
                  }`}
                >
                  <ShoppingCart className="w-5 h-5" />
                  <span>{isAdded ? 'Added to Cart!' : !anyInStock ? 'Out of Stock' : isAdding ? 'Adding…' : 'Add to Cart'}</span>
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => toggleFavorite(product)}
                  aria-label={isLiked ? 'Remove from favourites' : 'Add to favourites'}
                  className="w-14 h-14 rounded-lg bg-dark-secondary border border-dark-border flex items-center justify-center hover:border-white transition-colors"
                >
                  <Heart className={`w-6 h-6 transition-colors ${isLiked ? 'fill-red-500 text-red-500' : 'text-white'}`} />
                </motion.button>
              </div>

              {isAdded ? (
                <p className="text-sm text-light-gray">
                  Added.{' '}
                  <Link href="/cart" className="text-white underline">
                    View your cart
                  </Link>
                </p>
              ) : null}
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ProductDetail;
