'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Trash2, Plus, Minus, ShoppingBag } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { inr } from '@/lib/format';

function Cart() {
  const router = useRouter();
  const { cartItems, removeFromCart, updateQuantity, cartTotal, cartHasIssues, isCartLoaded } = useCart();
  const { isLoggedIn, isLoading: authLoading, setLoginModalOpen } = useAuth();
  const [message, setMessage] = useState('');
  const [busyId, setBusyId] = useState(null);

  // wait for the session and cart so the page never flashes "cart is empty"
  if (authLoading || !isCartLoaded) return <div className="min-h-[60vh]" />;

  if (!isLoggedIn) {
    return (
      <div className="bg-dark">
        <div className="pt-32 pb-20 px-4 flex flex-col items-center justify-center min-h-[60vh] text-center">
          <ShoppingBag className="w-24 h-24 text-light-gray mb-6" />
          <h2 className="text-3xl font-bold text-white mb-4">Log in to see your cart</h2>
          <p className="text-light-gray mb-8">Your cart is saved to your account, so it follows you on any device.</p>
          <button
            onClick={() => setLoginModalOpen(true)}
            className="px-8 py-3 bg-white text-black rounded-lg hover:bg-lighter-gray transition-all"
          >
            Log in
          </button>
        </div>
      </div>
    );
  }

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

  const act = async (id, action) => {
    setMessage('');
    setBusyId(id);
    const result = await action();
    setBusyId(null);
    if (!result.ok) setMessage(result.error);
  };

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

          {message ? (
            <p role="alert" className="mb-6 rounded-lg border border-red-500/40 px-4 py-3 text-sm text-red-300">
              {message}
            </p>
          ) : null}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Cart Items */}
            <div className="lg:col-span-2 space-y-4">
              {cartItems.map((item, index) => (
                <motion.div
                  key={item.variantId}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="bg-dark-secondary border border-dark-border rounded-xl p-6 flex gap-6"
                >
                  <div className="w-32 h-32 rounded-lg overflow-hidden bg-dark flex-shrink-0">
                    <img
                      src={item.image || '/products/urban-tee.jpg'}
                      alt={item.name}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  <div className="flex-1 flex flex-col justify-between">
                    <div>
                      <h3 className="text-xl font-semibold text-white mb-1">{item.name}</h3>
                      <p className="text-light-gray text-sm">
                        {item.size} · {item.color}
                      </p>
                      <p className="text-light-gray text-sm mb-2">{item.price} each</p>
                      {item.issue ? <p className="text-sm font-medium text-amber-400">{item.issue}</p> : null}
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => act(item.variantId, () => updateQuantity(item.variantId, item.quantity - 1))}
                          disabled={busyId === item.variantId}
                          aria-label={`Decrease quantity of ${item.name}`}
                          className="w-8 h-8 rounded-lg bg-dark border border-dark-border flex items-center justify-center hover:border-white transition-colors disabled:opacity-50"
                        >
                          <Minus className="w-4 h-4 text-white" />
                        </button>
                        <span className="text-white font-medium w-8 text-center">{item.quantity}</span>
                        <button
                          onClick={() => act(item.variantId, () => updateQuantity(item.variantId, item.quantity + 1))}
                          disabled={busyId === item.variantId || item.quantity >= Math.min(item.stock, 10)}
                          aria-label={`Increase quantity of ${item.name}`}
                          className="w-8 h-8 rounded-lg bg-dark border border-dark-border flex items-center justify-center hover:border-white transition-colors disabled:opacity-40"
                        >
                          <Plus className="w-4 h-4 text-white" />
                        </button>
                      </div>

                      <p className="text-2xl font-bold text-white">{inr(item.lineTotal, 2)}</p>
                    </div>
                  </div>

                  <button
                    onClick={() => act(item.variantId, () => removeFromCart(item.variantId))}
                    disabled={busyId === item.variantId}
                    aria-label={`Remove ${item.name} from cart`}
                    className="text-light-gray hover:text-red-500 transition-colors self-start"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </motion.div>
              ))}
            </div>

            {/* Order Summary */}
            <motion.div initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} className="lg:col-span-1">
              <div className="bg-dark-secondary border border-dark-border rounded-xl p-6 sticky top-32">
                <h2 className="text-2xl font-bold text-white mb-6">Order Summary</h2>

                <div className="space-y-4 mb-6">
                  <div className="flex justify-between text-light-gray">
                    <span>Subtotal</span>
                    <span>{inr(cartTotal, 2)}</span>
                  </div>
                  <div className="flex justify-between text-light-gray">
                    <span>Shipping</span>
                    <span>Calculated at checkout</span>
                  </div>
                  <div className="border-t border-dark-border pt-4 flex justify-between text-white text-xl font-bold">
                    <span>Total</span>
                    <span>{inr(cartTotal, 2)}</span>
                  </div>
                </div>

                {cartHasIssues ? (
                  <p className="mb-3 text-sm text-amber-400">
                    Some items are unavailable or low in stock. Please adjust them to continue.
                  </p>
                ) : null}

                <button
                  onClick={() => router.push('/checkout')}
                  disabled={cartHasIssues}
                  className="w-full py-4 bg-white text-black rounded-lg font-medium hover:bg-lighter-gray transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
