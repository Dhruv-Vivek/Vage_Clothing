'use client';

import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { MapPin, Truck, CreditCard, Check } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { deliveryOptions } from '@/data/products';

function Checkout() {
  const router = useRouter();
  const { cartItems, cartTotal, clearCart, isCartLoaded } = useCart();
  const { user, isLoggedIn, hasMembership, membershipType } = useAuth();
  
  const [currentStep, setCurrentStep] = useState(1);
  const [shippingInfo, setShippingInfo] = useState({
    fullName: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
  });
  const [selectedDelivery, setSelectedDelivery] = useState('standard');

  const orderPlaced = useRef(false);

  // Redirect if the cart is empty. Done in an effect because navigation must not happen
  // during render; skipped right after placing an order (the cart is cleared on purpose).
  useEffect(() => {
    if (isCartLoaded && cartItems.length === 0 && !orderPlaced.current) {
      router.replace('/cart');
    }
  }, [isCartLoaded, cartItems.length, router]);

  if (!isCartLoaded || cartItems.length === 0) return null;

  // Calculate delivery price based on membership
  const getDeliveryPrice = (option) => {
    if (hasMembership) {
      return 0; // Free for all members
    }
    return deliveryOptions.find(d => d.id === option)?.price || 0;
  };

  const deliveryPrice = getDeliveryPrice(selectedDelivery);
  const finalTotal = cartTotal + deliveryPrice;

  const handleShippingSubmit = (e) => {
    e.preventDefault();
    if (!isLoggedIn) {
      alert('Please login to continue');
      // In real app, redirect to login
      return;
    }
    setCurrentStep(2);
  };

  const handleDeliverySubmit = () => {
    setCurrentStep(3);
  };

  const handlePlaceOrder = () => {
    // Save order to localStorage (temporary)
    const order = {
      id: Date.now(),
      items: cartItems,
      shippingInfo,
      delivery: selectedDelivery,
      total: finalTotal,
      date: new Date().toISOString(),
    };
    
    const orders = JSON.parse(localStorage.getItem('orders') || '[]');
    orders.push(order);
    localStorage.setItem('orders', JSON.stringify(orders));

    orderPlaced.current = true;
    clearCart();
    router.push(`/order-success?orderId=${order.id}`);
  };

  const steps = [
    { number: 1, name: 'Shipping', icon: MapPin },
    { number: 2, name: 'Delivery', icon: Truck },
    { number: 3, name: 'Payment', icon: CreditCard },
  ];

  return (
    <div className="bg-dark">

      <div className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Progress Steps */}
          <div className="mb-12">
            <div className="flex items-center justify-center">
              {steps.map((step, index) => {
                const Icon = step.icon;
                const isActive = currentStep >= step.number;
                const isCompleted = currentStep > step.number;

                return (
                  <div key={step.number} className="flex items-center">
                    <div className="flex flex-col items-center">
                      <motion.div
                        initial={{ scale: 0.8 }}
                        animate={{ scale: 1 }}
                        className={`w-12 h-12 rounded-full flex items-center justify-center ${
                          isActive
                            ? 'bg-white text-black'
                            : 'bg-dark-secondary text-light-gray'
                        } border-2 ${
                          isActive ? 'border-white' : 'border-dark-border'
                        }`}
                      >
                        {isCompleted ? (
                          <Check className="w-6 h-6" />
                        ) : (
                          <Icon className="w-6 h-6" />
                        )}
                      </motion.div>
                      <p
                        className={`mt-2 text-sm font-medium ${
                          isActive ? 'text-white' : 'text-light-gray'
                        }`}
                      >
                        {step.name}
                      </p>
                    </div>
                    {index < steps.length - 1 && (
                      <div
                        className={`w-24 h-0.5 mx-4 ${
                          currentStep > step.number
                            ? 'bg-white'
                            : 'bg-dark-border'
                        }`}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main Content */}
            <div className="lg:col-span-2">
              {/* Step 1: Shipping Information */}
              {currentStep === 1 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-dark-secondary border border-dark-border rounded-xl p-8"
                >
                  <h2 className="text-2xl font-bold text-white mb-6">
                    Shipping Information
                  </h2>
                  <form onSubmit={handleShippingSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-white mb-2">
                          Full Name *
                        </label>
                        <input
                          type="text"
                          required
                          value={shippingInfo.fullName}
                          onChange={(e) =>
                            setShippingInfo({ ...shippingInfo, fullName: e.target.value })
                          }
                          className="w-full px-4 py-3 bg-dark border border-dark-border rounded-lg text-white focus:outline-none focus:border-white"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-white mb-2">
                          Email *
                        </label>
                        <input
                          type="email"
                          required
                          value={shippingInfo.email}
                          onChange={(e) =>
                            setShippingInfo({ ...shippingInfo, email: e.target.value })
                          }
                          className="w-full px-4 py-3 bg-dark border border-dark-border rounded-lg text-white focus:outline-none focus:border-white"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-white mb-2">
                        Phone Number *
                      </label>
                      <input
                        type="tel"
                        required
                        value={shippingInfo.phone}
                        onChange={(e) =>
                          setShippingInfo({ ...shippingInfo, phone: e.target.value })
                        }
                        className="w-full px-4 py-3 bg-dark border border-dark-border rounded-lg text-white focus:outline-none focus:border-white"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-white mb-2">
                        Address *
                      </label>
                      <textarea
                        required
                        rows="3"
                        value={shippingInfo.address}
                        onChange={(e) =>
                          setShippingInfo({ ...shippingInfo, address: e.target.value })
                        }
                        className="w-full px-4 py-3 bg-dark border border-dark-border rounded-lg text-white focus:outline-none focus:border-white"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-white mb-2">
                          City *
                        </label>
                        <input
                          type="text"
                          required
                          value={shippingInfo.city}
                          onChange={(e) =>
                            setShippingInfo({ ...shippingInfo, city: e.target.value })
                          }
                          className="w-full px-4 py-3 bg-dark border border-dark-border rounded-lg text-white focus:outline-none focus:border-white"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-white mb-2">
                          State *
                        </label>
                        <input
                          type="text"
                          required
                          value={shippingInfo.state}
                          onChange={(e) =>
                            setShippingInfo({ ...shippingInfo, state: e.target.value })
                          }
                          className="w-full px-4 py-3 bg-dark border border-dark-border rounded-lg text-white focus:outline-none focus:border-white"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-white mb-2">
                          Pincode *
                        </label>
                        <input
                          type="text"
                          required
                          value={shippingInfo.pincode}
                          onChange={(e) =>
                            setShippingInfo({ ...shippingInfo, pincode: e.target.value })
                          }
                          className="w-full px-4 py-3 bg-dark border border-dark-border rounded-lg text-white focus:outline-none focus:border-white"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="w-full py-4 bg-white text-black rounded-lg font-medium hover:bg-lighter-gray transition-all"
                    >
                      Continue to Delivery
                    </button>
                  </form>
                </motion.div>
              )}

              {/* Step 2: Delivery Options */}
              {currentStep === 2 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-dark-secondary border border-dark-border rounded-xl p-8"
                >
                  <h2 className="text-2xl font-bold text-white mb-6">
                    Choose Delivery Option
                  </h2>

                  {hasMembership && (
                    <div className="mb-6 p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                      <p className="text-green-400 font-medium">
                        🎉 Free delivery on all orders for {membershipType} members!
                      </p>
                    </div>
                  )}

                  <div className="space-y-4">
                    {deliveryOptions.map((option) => (
                      <label
                        key={option.id}
                        className={`block p-6 rounded-xl border-2 cursor-pointer transition-all ${
                          selectedDelivery === option.id
                            ? 'border-white bg-white/5'
                            : 'border-dark-border hover:border-light-gray'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <input
                              type="radio"
                              name="delivery"
                              value={option.id}
                              checked={selectedDelivery === option.id}
                              onChange={(e) => setSelectedDelivery(e.target.value)}
                              className="w-5 h-5"
                            />
                            <div>
                              <p className="text-white font-semibold">
                                {option.name}
                              </p>
                              <p className="text-light-gray text-sm">
                                Estimated delivery: {option.days}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            {hasMembership ? (
                              <p className="text-green-400 font-bold">FREE</p>
                            ) : (
                              <p className="text-white font-bold">₹{option.price}</p>
                            )}
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>

                  {!hasMembership && (
                    <div className="mt-6 p-4 bg-dark border border-dark-border rounded-lg">
                      <p className="text-light-gray text-sm mb-2">
                        💡 Want free delivery on all orders?
                      </p>
                      <button
                        onClick={() => router.push('/membership')}
                        className="text-white font-medium underline hover:text-lighter-gray"
                      >
                        Check out our membership plans →
                      </button>
                    </div>
                  )}

                  <div className="flex gap-4 mt-6">
                    <button
                      onClick={() => setCurrentStep(1)}
                      className="flex-1 py-4 bg-dark-secondary border border-dark-border text-white rounded-lg font-medium hover:border-white transition-all"
                    >
                      Back
                    </button>
                    <button
                      onClick={handleDeliverySubmit}
                      className="flex-1 py-4 bg-white text-black rounded-lg font-medium hover:bg-lighter-gray transition-all"
                    >
                      Continue to Payment
                    </button>
                  </div>
                </motion.div>
              )}

              {/* Step 3: Payment */}
              {currentStep === 3 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-dark-secondary border border-dark-border rounded-xl p-8"
                >
                  <h2 className="text-2xl font-bold text-white mb-6">Payment</h2>
                  
                  <div className="space-y-4 mb-6">
                    <div className="p-6 bg-dark border border-dark-border rounded-lg">
                      <p className="text-light-gray text-sm mb-4">
                        For this demo, payment integration is not active.
                      </p>
                      <p className="text-white">
                        Click "Place Order" to complete your purchase.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <button
                      onClick={() => setCurrentStep(2)}
                      className="flex-1 py-4 bg-dark-secondary border border-dark-border text-white rounded-lg font-medium hover:border-white transition-all"
                    >
                      Back
                    </button>
                    <button
                      onClick={handlePlaceOrder}
                      className="flex-1 py-4 bg-white text-black rounded-lg font-medium hover:bg-lighter-gray transition-all"
                    >
                      Place Order
                    </button>
                  </div>
                </motion.div>
              )}
            </div>

            {/* Order Summary Sidebar */}
            <div className="lg:col-span-1">
              <motion.div
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-dark-secondary border border-dark-border rounded-xl p-6 sticky top-32"
              >
                <h2 className="text-xl font-bold text-white mb-6">Order Summary</h2>

                <div className="space-y-4 mb-6">
                  {cartItems.map((item) => (
                    <div key={item.id} className="flex gap-4">
                      <div className="w-16 h-16 rounded-lg overflow-hidden bg-dark flex-shrink-0">
                        <img
                          src={item.image}
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-1">
                        <p className="text-white font-medium text-sm">{item.name}</p>
                        <p className="text-light-gray text-xs">Qty: {item.quantity}</p>
                      </div>
                      <p className="text-white font-medium">{item.price}</p>
                    </div>
                  ))}
                </div>

                <div className="border-t border-dark-border pt-4 space-y-3">
                  <div className="flex justify-between text-light-gray">
                    <span>Subtotal</span>
                    <span>₹{cartTotal.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-light-gray">
                    <span>Delivery</span>
                    <span>
                      {deliveryPrice === 0 ? (
                        <span className="text-green-400">FREE</span>
                      ) : (
                        `₹${deliveryPrice}`
                      )}
                    </span>
                  </div>
                  <div className="border-t border-dark-border pt-3 flex justify-between text-white text-xl font-bold">
                    <span>Total</span>
                    <span>₹{finalTotal.toLocaleString()}</span>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}

export default Checkout;