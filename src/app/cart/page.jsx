'use client';

import { motion } from 'framer-motion';
import { Trash2, Plus, Minus, ShoppingBag, AlertTriangle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCart } from '@/context/CartContext';

function formatPrice(value) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function Cart() {
  const router = useRouter();
  const { cartItems, removeFromCart, updateQuantity, cartTotal, isCartLoaded } = useCart();

  if (!isCartLoaded) return <div className="min-h-[60vh]" />;

  if (cartItems.length === 0) {
    return (
      <div className="bg-dark">
        <div className="pt-32 pb-20 px-4 flex flex-col items-center justify-center min-h-[60vh]">
          <ShoppingBag className="w-24 h-24 text-light-gray mb-6" />
          <h2 className="text-3xl font-bold text-white mb-4">Your cart is empty</h2>
          <p className="text-light-gray mb-8">Add some products to get started!</p>
          <button onClick={() => router.push('/products')} className="px-8 py-3 bg-white text-black rounded-lg hover:bg-lighter-gray transition-all">
            Shop Now
          </button>
        </div>
      </div>
    );
  }

  const needsVariant = cartItems.some((item) => !Number.isSafeInteger(Number(item.variantId)));

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

          {needsVariant && (
            <div className="mb-6 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 flex gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-300 flex-shrink-0" />
              <div>
                <p className="text-amber-100 font-semibold">Some older cart items need a size and colour selection.</p>
                <p className="text-amber-100/80 text-sm mt-1">
                  Remove those items and add them again from the product page. Checkout now requires an exact stock-tracked variant.
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-4">
              {cartItems.map((item, index) => {
                const hasVariant = Number.isSafeInteger(Number(item.variantId));
                const unitPrice = Number.isFinite(Number(item.unitPrice))
                  ? Number(item.unitPrice)
                  : Number(String(item.price || '0').replace(/[^0-9.]/g, '')) || 0;

                return (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="bg-dark-secondary border border-dark-border rounded-xl p-6 flex gap-6"
                  >
                    <div className="w-28 h-28 md:w-32 md:h-32 rounded-lg overflow-hidden bg-dark flex-shrink-0">
                      <img
                        src={item.image || '/products/urban-tee.jpg'}
                        alt={item.name}
                        className="w-full h-full object-cover"
                        onError={(event) => { event.currentTarget.src = '/products/urban-tee.jpg'; }}
                      />
                    </div>

                    <div className="flex-1 flex flex-col justify-between min-w-0">
                      <div>
                        <h3 className="text-xl font-semibold text-white mb-2">{item.name}</h3>
                        <p className="text-light-gray text-sm">{item.category || 'Premium Collection'}</p>
                        {hasVariant ? (
                          <p className="text-light-gray text-sm mt-2">
                            Size: {item.size} · Colour: {item.color}
                          </p>
                        ) : (
                          <button
                            onClick={() => router.push(`/products/${item.productId || item.id}`)}
                            className="text-amber-300 text-sm mt-2 underline"
                          >
                            Choose size and colour
                          </button>
                        )}
                      </div>

                      <div className="flex items-center justify-between gap-3 mt-5">
                        {hasVariant ? (
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => updateQuantity(item.id, item.quantity - 1)}
                              className="w-8 h-8 rounded-lg bg-dark border border-dark-border flex items-center justify-center hover:border-white transition-colors"
                            >
                              <Minus className="w-4 h-4 text-white" />
                            </button>
                            <span className="text-white font-medium w-8 text-center">{item.quantity}</span>
                            <button
                              onClick={() => updateQuantity(item.id, item.quantity + 1)}
                              disabled={Number(item.quantity) >= Number(item.stockQuantity || 0)}
                              className="w-8 h-8 rounded-lg bg-dark border border-dark-border flex items-center justify-center hover:border-white transition-colors disabled:opacity-40"
                            >
                              <Plus className="w-4 h-4 text-white" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-amber-200 text-sm">Re-add with a selected variant</span>
                        )}
                        <p className="text-xl font-bold text-white">{formatPrice(unitPrice * Number(item.quantity || 1))}</p>
                      </div>
                    </div>

                    <button
                      onClick={() => removeFromCart(item.id)}
                      aria-label={`Remove ${item.name} from cart`}
                      className="text-light-gray hover:text-red-500 transition-colors self-start"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </motion.div>
                );
              })}
            </div>

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
                    <span>{formatPrice(cartTotal)}</span>
                  </div>
                  <div className="flex justify-between text-light-gray">
                    <span>Shipping</span>
                    <span>Calculated at checkout</span>
                  </div>
                  <div className="border-t border-dark-border pt-4 flex justify-between text-white text-xl font-bold">
                    <span>Subtotal</span>
                    <span>{formatPrice(cartTotal)}</span>
                  </div>
                </div>

                <button
                  onClick={() => router.push('/checkout')}
                  disabled={needsVariant}
                  className="w-full py-4 bg-white text-black rounded-lg font-medium hover:bg-lighter-gray transition-all disabled:opacity-40 disabled:cursor-not-allowed"
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
