'use client';

import { motion } from 'framer-motion';
import { Heart, ShoppingCart } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCart } from '../context/CartContext';

function ProductCard({ product, index }) {
  const router = useRouter();
  const { toggleFavorite, isFavorite } = useCart();
  const isLiked = isFavorite(product.id);
  const isOutOfStock = Number(product.availableStock ?? 0) <= 0;

  // A cart line is a specific size and colour, so choosing one happens on the product page.
  const handleChooseOptions = (e) => {
    e.stopPropagation();
    router.push(`/products/${product.id}`);
  };

  const handleToggleFavorite = (e) => {
    e.stopPropagation();
    toggleFavorite(product);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      className="group relative"
    >
      {/* Product Image Container */}
      <div
        className="relative aspect-[3/4] rounded-2xl overflow-hidden bg-dark-secondary cursor-pointer"
        onClick={() => router.push(`/products/${product.id}`)}
      >
        <img
          src={product.image}
          alt={product.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          onError={(e) => {
            e.target.src = 'https://via.placeholder.com/400x500/1a1a1a/ffffff?text=' + product.name;
          }}
        />

        {/* Overlay on hover */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-300"></div>

        {/* Action Buttons */}
        <div className="absolute top-4 right-4 flex flex-col gap-2">
          {/* Wishlist Button */}
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={handleToggleFavorite}
            className="w-10 h-10 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center hover:bg-white transition-all duration-300 z-10"
          >
            <Heart
              className={`w-5 h-5 transition-colors ${isLiked ? 'fill-red-500 text-red-500' : 'text-black'}`}
            />
          </motion.button>

          {/* Add to Cart Button */}
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={handleChooseOptions}
            disabled={isOutOfStock}
            aria-label={isOutOfStock ? `${product.name} is out of stock` : `Choose size and colour for ${product.name}`}
            className="w-10 h-10 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center hover:bg-white transition-all duration-300 z-10"
          >
            <ShoppingCart className={`w-5 h-5 ${isOutOfStock ? 'text-gray-400' : 'text-black'}`} />
          </motion.button>
        </div>
      </div>

      {/* Product Info */}
      <div className="mt-4 space-y-2">
        <p className="text-sm text-light-gray">{product.category}</p>
        {isOutOfStock && <p className="text-xs text-red-300">Out of stock</p>}
        <h3 className="text-lg font-semibold text-white group-hover:text-lighter-gray transition-colors">
          {product.name}
        </h3>
        <p className="text-xl font-bold text-white">{product.price}</p>
      </div>
    </motion.div>
  );
}

export default ProductCard;