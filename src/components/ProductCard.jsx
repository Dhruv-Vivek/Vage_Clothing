import { motion } from 'framer-motion';
import { Heart } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

function ProductCard({ product, index }) {
  const [isLiked, setIsLiked] = useState(false);
  const navigate = useNavigate();

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
        onClick={() => navigate(`/products/${product.id}`)}
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

        {/* Wishlist Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsLiked(!isLiked);
          }}
          className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center hover:bg-white transition-all duration-300 z-10"
        >
          <Heart 
            className={`w-5 h-5 transition-colors ${isLiked ? 'fill-red-500 text-red-500' : 'text-black'}`}
          />
        </button>
      </div>

      {/* Product Info */}
      <div className="mt-4 space-y-2">
        <p className="text-sm text-light-gray">{product.category}</p>
        <h3 className="text-lg font-semibold text-white group-hover:text-lighter-gray transition-colors">
          {product.name}
        </h3>
        <p className="text-xl font-bold text-white">{product.price}</p>
      </div>
    </motion.div>
  );
}

export default ProductCard;