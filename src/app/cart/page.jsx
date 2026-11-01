'use client';

import { motion } from 'framer-motion';
import { Trash2, Plus, Minus, ShoppingBag } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCart } from '@/context/CartContext';

function Cart() {
  const router = useRouter();
  const { cartItems, removeFromCart, updateQuantity, cartTotal, isCartLoaded } = useCart();

  // wait for localStorage so the server-rendered page never flashes "cart is empty"
  if (!isCartLoaded) return <div className="min-h-[60vh]" />;

  if (cartItems.length === 0) {
    return (
      <div className="bg-dark">
        <div className="pt-32 pb-20 px-4 flex flex-col items-center justify-center min-h-[60vh]">
          <ShoppingBag className="w-24 h-24 text-light-gray mb-6" />
          <h2 className="text-3xl font-bold text-white mb-4">Your cart is empty</h2>
          <p className="text-light-gray mb-8">Add some products to get started!</p>
          <button
            onClick={() => router.push('/products')}
            className="px-8 py-3 bg-white text-black rounded-lg hover:bg-lighter-gray transition-all"
          >
            Shop Now
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-dark">

      <div className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-5xl font-bold text-white mb-12"
          >
            My Cart
          </motion.h1>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Cart Items */}
            <div className="lg:col-span-2 space-y-4">
              {cartItems.map((item, index) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="bg-dark-secondary border border-dark-border rounded-xl p-6 flex gap-6"
                >
                  {/* Product Image */}
                  <div className="w-32 h-32 rounded-lg overflow-hidden bg-dark flex-shrink-0">
                    <img
                      src={item.image}
                      alt={item.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.target.src = 'https://via.placeholder.com/200x200/1a1a1a/ffffff?text=' + item.name;
                      }}
                    />
                  </div>

                  {/* Product Info */}
                  <div className="flex-1 flex flex-col justify-between">
                    <div>
                      <h3 className="text-xl font-semibold text-white mb-2">
                        {item.name}
                      </h3>
                      <p className="text-light-gray text-sm mb-4">
                        {item.category || 'Premium Collection'}
                      </p>
                    </div>

                    <div className="flex items-center justify-between">
                      {/* Quantity Controls */}
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          className="w-8 h-8 rounded-lg bg-dark border border-dark-border flex items-center justify-center hover:border-white transition-colors"
                        >
                          <Minus className="w-4 h-4 text-white" />
                        </button>
                        <span className="text-white font-medium w-8 text-center">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          className="w-8 h-8 rounded-lg bg-dark border border-dark-border flex items-center justify-center hover:border-white transition-colors"
                        >
                          <Plus className="w-4 h-4 text-white" />
                        </button>
                      </div>

                      {/* Price */}
                      <div className="text-right">
                        <p className="text-2xl font-bold text-white">
                          {item.price}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Remove Button */}
                  <button
                    onClick={() => removeFromCart(item.id)}
                    className="text-light-gray hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </motion.div>
              ))}
            </div>

            {/* Order Summary */}
            <motion.div
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              className="lg:col-span-1"
            >
              <div className="bg-dark-secondary border border-dark-border rounded-xl p-6 sticky top-32">
                <h2 className="text-2xl font-bold text-white mb-6">Order Summary</h2>

                <div className="space-y-4 mb-6">
                  <div className="flex justify-between text-light-gray">
                    <span>Subtotal</span>
                    <span>₹{cartTotal.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-light-gray">
                    <span>Shipping</span>
                    <span>Calculated at checkout</span>
                  </div>
                  <div className="border-t border-dark-border pt-4 flex justify-between text-white text-xl font-bold">
                    <span>Total</span>
                    <span>₹{cartTotal.toLocaleString()}</span>
                  </div>
                </div>

                <button
                  onClick={() => router.push('/checkout')}
                  className="w-full py-4 bg-white text-black rounded-lg font-medium hover:bg-lighter-gray transition-all"
                >
                  Proceed to Checkout
                </button>

                <button
                  onClick={() => router.push('/products')}
                  className="w-full mt-3 py-4 bg-dark-secondary border border-dark-border text-white rounded-lg font-medium hover:border-white transition-all"
                >
                  Continue Shopping
                </button>
              </div>
            </motion.div>
          </div>
        </div>
      </div>

    </div>
  );
}

export default Cart;