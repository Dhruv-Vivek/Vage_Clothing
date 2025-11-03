import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ShoppingCart, Heart, ArrowLeft, Minus, Plus } from 'lucide-react';
import { useState } from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { products, premiumCollection } from '../data/products';
import { useCart } from '../context/CartContext';

function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToCart, toggleFavorite, isFavorite } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [isAdded, setIsAdded] = useState(false);

  // Find product from both collections
  const allProducts = [...products, ...premiumCollection];
  const product = allProducts.find(p => p.id === parseInt(id));

  if (!product) {
    return (
      <div className="min-h-screen bg-dark flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl text-white mb-4">Product Not Found</h1>
          <button
            onClick={() => navigate('/products')}
            className="px-6 py-3 bg-white text-black rounded-lg"
          >
            Back to Products
          </button>
        </div>
      </div>
    );
  }

  const handleAddToCart = () => {
    for (let i = 0; i < quantity; i++) {
      addToCart(product);
    }
    setIsAdded(true);
    setTimeout(() => setIsAdded(false), 2000);
  };

  const isLiked = isFavorite(product.id);

  return (
    <div className="min-h-screen bg-dark">
      <Navbar />

      <div className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Back Button */}
          <motion.button
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-light-gray hover:text-white transition-colors mb-8"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back</span>
          </motion.button>

          {/* Product Detail Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* Product Image */}
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              className="relative aspect-square rounded-2xl overflow-hidden bg-dark-secondary"
            >
              <img
                src={product.image}
                alt={product.name}
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.target.src = 'https://via.placeholder.com/800x800/1a1a1a/ffffff?text=' + product.name;
                }}
              />
            </motion.div>

            {/* Product Info */}
            <motion.div
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              className="space-y-6"
            >
              {/* Category */}
              <p className="text-light-gray text-sm uppercase tracking-wider">
                {product.category || 'Premium Collection'}
              </p>

              {/* Product Name */}
              <h1 className="text-4xl md:text-5xl font-bold text-white">
                {product.name}
              </h1>

              {/* Price */}
              <div className="text-4xl font-bold text-white">
                {product.price}
              </div>

              {/* Description */}
              <p className="text-light-gray text-lg leading-relaxed">
                {product.description || 'Premium quality product crafted with attention to detail.'}
              </p>

              {/* Specifications */}
              <div className="grid grid-cols-3 gap-4 py-6 border-y border-dark-border">
                <div>
                  <p className="text-sm text-light-gray mb-1">Material</p>
                  <p className="text-white font-medium">{product.specs.material}</p>
                </div>
                <div>
                  <p className="text-sm text-light-gray mb-1">Fit</p>
                  <p className="text-white font-medium">{product.specs.fit}</p>
                </div>
                <div>
                  <p className="text-sm text-light-gray mb-1">Origin</p>
                  <p className="text-white font-medium">{product.specs.origin}</p>
                </div>
              </div>

              {/* Quantity Selector */}
              <div className="space-y-3">
                <label className="text-white font-medium">Quantity</label>
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="w-10 h-10 rounded-lg bg-dark-secondary border border-dark-border flex items-center justify-center hover:border-white transition-colors"
                  >
                    <Minus className="w-4 h-4 text-white" />
                  </button>
                  <span className="text-2xl font-bold text-white w-12 text-center">
                    {quantity}
                  </span>
                  <button
                    onClick={() => setQuantity(quantity + 1)}
                    className="w-10 h-10 rounded-lg bg-dark-secondary border border-dark-border flex items-center justify-center hover:border-white transition-colors"
                  >
                    <Plus className="w-4 h-4 text-white" />
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-4">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleAddToCart}
                  className={`flex-1 px-8 py-4 rounded-lg font-medium transition-all duration-300 flex items-center justify-center gap-2 ${
                    isAdded
                      ? 'bg-green-500 text-white'
                      : 'bg-white text-black hover:bg-lighter-gray'
                  }`}
                >
                  <ShoppingCart className="w-5 h-5" />
                  <span>{isAdded ? 'Added to Cart!' : 'Add to Cart'}</span>
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => toggleFavorite(product)}
                  className="w-14 h-14 rounded-lg bg-dark-secondary border border-dark-border flex items-center justify-center hover:border-white transition-colors"
                >
                  <Heart
                    className={`w-6 h-6 transition-colors ${
                      isLiked ? 'fill-red-500 text-red-500' : 'text-white'
                    }`}
                  />
                </motion.button>
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}

export default ProductDetail;