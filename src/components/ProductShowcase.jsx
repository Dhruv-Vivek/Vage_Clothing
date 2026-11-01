'use client';

import { motion } from 'framer-motion';
import { ShoppingCart } from 'lucide-react';
import { CardContainer, CardBody, CardItem } from './ui/card-3d';
import { useState } from 'react';
import { useCart } from '../context/CartContext';

function ProductShowcase({ product, reverse = false }) {
  const [isAdded, setIsAdded] = useState(false);
  const { addToCart } = useCart();

  const handleAddToCart = () => {
    addToCart(product);
    setIsAdded(true);
    setTimeout(() => setIsAdded(false), 2000);
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 50 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.8 }}
      className="py-20 px-4 sm:px-6 lg:px-8"
    >
      <div className="max-w-7xl mx-auto">
        <div className={`grid grid-cols-1 lg:grid-cols-2 gap-12 items-center ${reverse ? 'lg:flex-row-reverse' : ''}`}>
          {/* Product Image - 3D Card */}
          <div className={`${reverse ? 'lg:order-2' : 'lg:order-1'}`}>
            <CardContainer className="w-full">
              <CardBody className="relative group/card w-full h-auto rounded-xl p-6 border border-dark-border bg-dark-secondary">
                <CardItem
                  translateZ="50"
                  className="w-full"
                >
                  <img
                    src={product.image}
                    alt={product.name}
                    className="w-full h-[500px] object-cover rounded-lg"
                    onError={(e) => {
                      e.target.src = 'https://via.placeholder.com/600x600/1a1a1a/ffffff?text=' + product.name;
                    }}
                  />
                </CardItem>
              </CardBody>
            </CardContainer>
          </div>

          {/* Product Info */}
          <div className={`${reverse ? 'lg:order-1' : 'lg:order-2'} space-y-6`}>
            <motion.h2
              initial={{ opacity: 0, x: reverse ? 50 : -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-3xl md:text-4xl lg:text-5xl font-bold text-white tracking-wide"
            >
              {product.name}
            </motion.h2>

            <motion.p
              initial={{ opacity: 0, x: reverse ? 50 : -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="text-light-gray text-base md:text-lg leading-relaxed"
            >
              {product.description}
            </motion.p>

            {/* Price and Add to Cart Button */}
            <motion.div
              initial={{ opacity: 0, x: reverse ? 50 : -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="flex items-center gap-6"
            >
              <span className="text-3xl font-bold text-white">{product.price}</span>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleAddToCart}
                className={`group px-6 py-3 rounded-lg transition-all duration-300 flex items-center gap-2 ${
                  isAdded 
                    ? 'bg-green-500 text-white' 
                    : 'bg-white text-black hover:bg-lighter-gray'
                }`}
              >
                <ShoppingCart className="w-5 h-5" />
                <span className="font-medium">
                  {isAdded ? 'Added to Cart!' : 'Add to Cart'}
                </span>
              </motion.button>
            </motion.div>

            {/* Specifications */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.5 }}
              className="grid grid-cols-3 gap-4 pt-6 border-t border-dark-border"
            >
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
            </motion.div>
          </div>
        </div>
      </div>
    </motion.section>
  );
}

export default ProductShowcase;