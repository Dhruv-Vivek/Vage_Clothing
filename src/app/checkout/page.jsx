'use client';

import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { MapPin, Truck, CreditCard, Check, Plus } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { deliveryOptions } from '@/data/products';
import { inr } from '@/lib/format';

async function postJson(url, body) {
  const response = await fetch(url, {
    method: 'POST',
    credentials: 'same-origin',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || 'Something went wrong. Please try again.');
    error.status = response.status;
    throw error;
  }
  return payload;
}

function loadRazorpayCheckout() {
  if (typeof window === 'undefined') return Promise.resolve(false);
  if (window.Razorpay) return Promise.resolve(true);

  return new Promise((resolve) => {
    const existing = document.getElementById('razorpay-checkout-script');
    if (existing) {
      existing.addEventListener('load', () => resolve(Boolean(window.Razorpay)), { once: true });
      existing.addEventListener('error', () => resolve(false), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.id = 'razorpay-checkout-script';
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(Boolean(window.Razorpay));
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

const inputClass =
  'w-full px-4 py-3 bg-dark border border-dark-border rounded-lg text-white focus:outline-none focus:border-white';

const EMPTY_FORM = { recipientName: '', phone: '', addressLine1: '', city: '', state: '', postalCode: '' };

function Checkout() {
  const router = useRouter();
  const { cartItems, cartTotal, cartHasIssues, clearCart, refreshCart, isCartLoaded } = useCart();
  const { user, isLoggedIn, isLoading: authLoading, hasMembership, membershipType, setLoginModalOpen } = useAuth();

  const [currentStep, setCurrentStep] = useState(1);
  const [addresses, setAddresses] = useState([]);
  const [addressesLoaded, setAddressesLoaded] = useState(false);
  const [selectedAddressId, setSelectedAddressId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [savingAddress, setSavingAddress] = useState(false);
  const [addressError, setAddressError] = useState('');

  const [selectedDelivery, setSelectedDelivery] = useState('standard');
  const [couponInput, setCouponInput] = useState('');
  const [coupon, setCoupon] = useState(null); // { code, discount }
  const [couponError, setCouponError] = useState('');
  const [applyingCoupon, setApplyingCoupon] = useState(false);

  const [placing, setPlacing] = useState(false);
  const [paymentPending, setPaymentPending] = useState(false);
  const [orderError, setOrderError] = useState('');

  const orderPlaced = useRef(false);
  const checkoutIdempotencyKey = useRef(null);
  const paymentHandled = useRef(false);

  // Load the customer's saved addresses once they are signed in.
  useEffect(() => {
    if (!isLoggedIn) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch('/api/addresses', { credentials: 'same-origin', cache: 'no-store' });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error);
        if (cancelled) return;
        setAddresses(body.addresses);
        const preferred = body.addresses.find((a) => a.isDefault) || body.addresses[0];
        setSelectedAddressId(preferred ? preferred.id : null);
        setShowForm(body.addresses.length === 0);
        setForm((f) => ({ ...f, recipientName: user?.name || '', phone: user?.phone || '' }));
      } catch {
        if (!cancelled) setAddressError('We could not load your saved addresses. Please refresh the page.');
      } finally {
        if (!cancelled) setAddressesLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLoggedIn, user?.name, user?.phone]);

  // Redirect if the cart is empty. Done in an effect because navigation must not happen
  // during render; skipped right after placing an order (the cart is cleared on purpose).
  useEffect(() => {
    if (isCartLoaded && isLoggedIn && cartItems.length === 0 && !orderPlaced.current) {
      router.replace('/cart');
    }
  }, [isCartLoaded, isLoggedIn, cartItems.length, router]);

  if (authLoading || !isCartLoaded) return null;

  if (!isLoggedIn) {
    return (
      <div className="bg-dark">
        <div className="pt-32 pb-20 px-4 flex flex-col items-center justify-center min-h-[60vh] text-center">
          <h2 className="text-3xl font-bold text-white mb-4">Log in to check out</h2>
          <p className="text-light-gray mb-8">Your order is saved to your account so you can track it later.</p>
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

  if (cartItems.length === 0) return null;

  const delivery = deliveryOptions.find((d) => d.id === selectedDelivery);
  const deliveryPrice = hasMembership ? 0 : delivery?.price || 0;
  const discount = coupon?.discount || 0;
  const finalTotal = Math.max(0, cartTotal - discount) + deliveryPrice;

  const saveAddress = async (event) => {
    event.preventDefault();
    setAddressError('');
    setSavingAddress(true);
    try {
      const payload = await postJson('/api/addresses', { ...form, isDefault: addresses.length === 0 });
      setAddresses(payload.addresses);
      setSelectedAddressId(payload.addressId);
      setShowForm(false);
      setForm((f) => ({ ...EMPTY_FORM, recipientName: f.recipientName, phone: f.phone }));
    } catch (error) {
      setAddressError(error.message);
    } finally {
      setSavingAddress(false);
    }
  };

  const applyCoupon = async () => {
    if (!couponInput.trim()) return;
    setCouponError('');
    setApplyingCoupon(true);
    try {
      const result = await postJson('/api/coupons/validate', { code: couponInput.trim() });
      setCoupon({ code: result.code, discount: result.discount });
      setCouponInput('');
    } catch (error) {
      setCoupon(null);
      setCouponError(error.message);
    } finally {
      setApplyingCoupon(false);
    }
  };

  const finishPaidOrder = async (orderId) => {
    checkoutIdempotencyKey.current = null;
    orderPlaced.current = true;
    // The payment-capture transaction removes purchased lines from MySQL.
    // Refresh first so the client cache also reflects the committed cart state.
    await refreshCart();
    clearCart();
    router.push(`/order-success?id=${orderId}`);
  };

  const reconcileDismissedPayment = async (preparedOrder) => {
    try {
      const result = await postJson('/api/payments/abandon', {
        orderId: preparedOrder.orderId,
        razorpayOrderId: preparedOrder.razorpayOrderId,
      });

      if (result.paymentStatus === 'PAID') {
        await finishPaidOrder(preparedOrder.orderId);
        return;
      }

      if (result.paymentStatus === 'PENDING') {
        setPaymentPending(true);
        setOrderError(
          result.message ||
          'Razorpay has authorised this payment and is awaiting capture. Do not make another payment. Check My Orders for the latest status.'
        );
      } else {
        checkoutIdempotencyKey.current = null;
        setOrderError('Payment was not completed. Your reserved stock has been released. You can try checkout again.');
      }
    } catch (error) {
      // We cannot safely create another charge until the gateway status is known.
      setPaymentPending(true);
      setOrderError(
        error.message ||
        'We could not confirm the payment status. Do not pay again; check My Orders shortly.'
      );
    } finally {
      setPlacing(false);
    }
  };

  const handlePlaceOrder = async () => {
    setOrderError('');
    if (paymentPending) return;

    const selectedAddress = addresses.find((address) => address.id === selectedAddressId);
    if (!selectedAddress) {
      setOrderError('Choose or save a delivery address before continuing.');
      return;
    }

    setPlacing(true);
    paymentHandled.current = false;

    try {
      if (!checkoutIdempotencyKey.current) {
        checkoutIdempotencyKey.current = window.crypto?.randomUUID
          ? window.crypto.randomUUID()
          : `vage_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      }

      const preparedOrder = await postJson('/api/checkout/create-order', {
        idempotencyKey: checkoutIdempotencyKey.current,
        items: cartItems.map((item) => ({
          variantId: item.variantId,
          quantity: item.quantity,
        })),
        shippingInfo: {
          fullName: selectedAddress.recipientName,
          email: user.email,
          phone: selectedAddress.phone,
          address: [selectedAddress.addressLine1, selectedAddress.addressLine2]
            .filter(Boolean)
            .join(', ')
            .slice(0, 200),
          city: selectedAddress.city,
          state: selectedAddress.state,
          pincode: selectedAddress.postalCode,
        },
        deliveryMethod: selectedDelivery,
        couponCode: coupon?.code || '',
      });

      if (preparedOrder.paymentProvider !== 'RAZORPAY') {
        throw new Error('Razorpay is not selected on the server. Set PAYMENT_PROVIDER=RAZORPAY in .env.local and restart the development server.');
      }
      if (!preparedOrder.razorpayOrderId || !preparedOrder.keyId || !preparedOrder.amount) {
        throw new Error('Razorpay did not return a valid checkout order. Please try again.');
      }

      const loaded = await loadRazorpayCheckout();
      if (!loaded || !window.Razorpay) {
        await reconcileDismissedPayment(preparedOrder);
        setOrderError('Razorpay Checkout could not be loaded. Check your internet connection and try again.');
        return;
      }

      const options = {
        key: preparedOrder.keyId,
        amount: preparedOrder.amount,
        currency: preparedOrder.currency || 'INR',
        name: 'VAGE Clothing',
        description: `Order ${preparedOrder.orderNumber}`,
        order_id: preparedOrder.razorpayOrderId,
        prefill: {
          name: selectedAddress.recipientName,
          email: user.email,
          contact: String(selectedAddress.phone || '').replace(/\\D/g, '').slice(-10),
        },
        notes: {
          vage_order_number: preparedOrder.orderNumber,
        },
        theme: { color: '#ffffff' },
        modal: {
          ondismiss: () => {
            if (paymentHandled.current) return;
            paymentHandled.current = true;
            void reconcileDismissedPayment(preparedOrder);
          },
        },
        handler: async (response) => {
          if (paymentHandled.current) return;
          paymentHandled.current = true;

          try {
            const verification = await postJson('/api/payments/verify', {
              orderId: preparedOrder.orderId,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });

            if (verification.paymentStatus === 'PAID') {
              await finishPaidOrder(preparedOrder.orderId);
              return;
            }

            setPaymentPending(true);
            setOrderError(
              verification.message ||
              'Razorpay has not confirmed capture yet. Do not pay again; check My Orders for the latest payment status.'
            );
            setPlacing(false);
          } catch (error) {
            // The gateway may already have collected payment. Never start another attempt
            // until the payment has been reconciled by the server/webhook.
            setPaymentPending(true);
            setOrderError(
              error.message ||
              'Payment was submitted, but VAGE could not verify it yet. Do not pay again; check My Orders shortly.'
            );
            setPlacing(false);
          }
        },
      };

      const razorpay = new window.Razorpay(options);
      razorpay.on('payment.failed', (event) => {
        const description = event?.error?.description;
        setOrderError(description || 'Razorpay could not complete the payment. You can retry inside the secure payment window.');
      });
      razorpay.open();
    } catch (error) {
      setOrderError(error.message || 'Unable to start Razorpay checkout. Please try again.');
      if (error.status === 409) refreshCart(); // stock changed: show the customer the up-to-date cart
      setPlacing(false);
    }
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
                          isActive ? 'bg-white text-black' : 'bg-dark-secondary text-light-gray'
                        } border-2 ${isActive ? 'border-white' : 'border-dark-border'}`}
                      >
                        {isCompleted ? <Check className="w-6 h-6" /> : <Icon className="w-6 h-6" />}
                      </motion.div>
                      <p className={`mt-2 text-sm font-medium ${isActive ? 'text-white' : 'text-light-gray'}`}>
                        {step.name}
                      </p>
                    </div>
                    {index < steps.length - 1 && (
                      <div
                        className={`w-24 h-0.5 mx-4 ${currentStep > step.number ? 'bg-white' : 'bg-dark-border'}`}
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
              {/* Step 1: Delivery address */}
              {currentStep === 1 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-dark-secondary border border-dark-border rounded-xl p-8"
                >
                  <h2 className="text-2xl font-bold text-white mb-2">Delivery Address</h2>
                  <p className="text-light-gray text-sm mb-6">
                    This order will be saved to your account ({user.email}).
                  </p>

                  {addressError ? (
                    <p role="alert" className="mb-4 rounded-lg border border-red-500/40 px-4 py-3 text-sm text-red-300">
                      {addressError}
                    </p>
                  ) : null}

                  {!addressesLoaded ? <p className="text-light-gray">Loading your addresses…</p> : null}

                  {addressesLoaded && addresses.length > 0 && (
                    <div className="space-y-3 mb-6" role="radiogroup" aria-label="Saved addresses">
                      {addresses.map((a) => (
                        <label
                          key={a.id}
                          className={`block p-5 rounded-xl border-2 cursor-pointer transition-all ${
                            selectedAddressId === a.id ? 'border-white bg-white/5' : 'border-dark-border hover:border-light-gray'
                          }`}
                        >
                          <div className="flex items-start gap-4">
                            <input
                              type="radio"
                              name="address"
                              checked={selectedAddressId === a.id}
                              onChange={() => setSelectedAddressId(a.id)}
                              className="mt-1 w-5 h-5"
                            />
                            <div className="text-sm">
                              <p className="text-white font-semibold">
                                {a.recipientName}
                                {a.isDefault ? <span className="ml-2 text-xs text-light-gray">Default</span> : null}
                              </p>
                              <p className="text-light-gray">{a.addressLine1}</p>
                              <p className="text-light-gray">
                                {a.city}, {a.state} {a.postalCode}
                              </p>
                              <p className="text-light-gray">Phone: {a.phone}</p>
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}

                  {addressesLoaded && !showForm && (
                    <div className="flex flex-col gap-3 sm:flex-row">
                      <button
                        type="button"
                        onClick={() => setShowForm(true)}
                        className="flex items-center justify-center gap-2 px-6 py-4 bg-dark border border-dark-border text-white rounded-lg hover:border-white transition-all"
                      >
                        <Plus className="w-4 h-4" /> Add a new address
                      </button>
                      <button
                        type="button"
                        disabled={!selectedAddressId}
                        onClick={() => setCurrentStep(2)}
                        className="flex-1 py-4 bg-white text-black rounded-lg font-medium hover:bg-lighter-gray transition-all disabled:opacity-50"
                      >
                        Continue to Delivery
                      </button>
                    </div>
                  )}

                  {addressesLoaded && showForm && (
                    <form onSubmit={saveAddress} className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-white mb-2" htmlFor="ship-name">Full Name *</label>
                          <input id="ship-name" type="text" required maxLength={120} value={form.recipientName}
                            onChange={(e) => setForm({ ...form, recipientName: e.target.value })} className={inputClass} />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-white mb-2" htmlFor="ship-phone">Phone Number *</label>
                          <input id="ship-phone" type="tel" required value={form.phone}
                            onChange={(e) => setForm({ ...form, phone: e.target.value })} className={inputClass} />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-white mb-2" htmlFor="ship-address">Address *</label>
                        <textarea id="ship-address" required rows="3" maxLength={200} value={form.addressLine1}
                          onChange={(e) => setForm({ ...form, addressLine1: e.target.value })} className={inputClass} />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-white mb-2" htmlFor="ship-city">City *</label>
                          <input id="ship-city" type="text" required maxLength={100} value={form.city}
                            onChange={(e) => setForm({ ...form, city: e.target.value })} className={inputClass} />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-white mb-2" htmlFor="ship-state">State *</label>
                          <input id="ship-state" type="text" required maxLength={100} value={form.state}
                            onChange={(e) => setForm({ ...form, state: e.target.value })} className={inputClass} />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-white mb-2" htmlFor="ship-pin">PIN Code *</label>
                          <input id="ship-pin" type="text" required inputMode="numeric" maxLength={6} pattern="[0-9]{6}" value={form.postalCode}
                            onChange={(e) => setForm({ ...form, postalCode: e.target.value })} className={inputClass} />
                        </div>
                      </div>

                      <div className="flex gap-3">
                        {addresses.length > 0 && (
                          <button type="button" onClick={() => setShowForm(false)}
                            className="px-6 py-4 bg-dark border border-dark-border text-white rounded-lg hover:border-white transition-all">
                            Cancel
                          </button>
                        )}
                        <button type="submit" disabled={savingAddress}
                          className="flex-1 py-4 bg-white text-black rounded-lg font-medium hover:bg-lighter-gray transition-all disabled:opacity-50">
                          {savingAddress ? 'Saving…' : 'Save address'}
                        </button>
                      </div>
                    </form>
                  )}
                </motion.div>
              )}

              {/* Step 2: Delivery Options */}
              {currentStep === 2 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-dark-secondary border border-dark-border rounded-xl p-8"
                >
                  <h2 className="text-2xl font-bold text-white mb-6">Choose Delivery Option</h2>

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
                          selectedDelivery === option.id ? 'border-white bg-white/5' : 'border-dark-border hover:border-light-gray'
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
                              <p className="text-white font-semibold">{option.name}</p>
                              <p className="text-light-gray text-sm">Estimated delivery: {option.days}</p>
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
                      <p className="text-light-gray text-sm mb-2">💡 Want free delivery on all orders?</p>
                      <button onClick={() => router.push('/membership')} className="text-white font-medium underline hover:text-lighter-gray">
                        Check out our membership plans →
                      </button>
                    </div>
                  )}

                  <div className="flex gap-4 mt-6">
                    <button onClick={() => setCurrentStep(1)}
                      className="flex-1 py-4 bg-dark-secondary border border-dark-border text-white rounded-lg font-medium hover:border-white transition-all">
                      Back
                    </button>
                    <button onClick={() => setCurrentStep(3)}
                      className="flex-1 py-4 bg-white text-black rounded-lg font-medium hover:bg-lighter-gray transition-all">
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

                  <div className="space-y-3 mb-6">
                    <div className="block p-5 rounded-xl border-2 border-white bg-white/5">
                      <div className="flex items-center gap-4">
                        <div className="w-5 h-5 rounded-full border-4 border-white bg-dark flex-shrink-0" aria-hidden="true" />
                        <div>
                          <p className="text-white font-semibold">Razorpay secure checkout</p>
                          <p className="text-light-gray text-sm">UPI, debit/credit cards, net banking and supported wallets.</p>
                        </div>
                      </div>
                    </div>
                    <p className="text-light-gray text-xs">
                      Your final amount is recalculated securely from MySQL before Razorpay opens. VAGE stores the order and verifies the payment signature on the server.
                    </p>
                  </div>

                  {cartHasIssues ? (
                    <p role="alert" className="mb-4 text-sm text-amber-400">
                      Some items in your cart are unavailable or low in stock.{' '}
                      <button onClick={() => router.push('/cart')} className="underline">Review your cart</button>
                    </p>
                  ) : null}

                  {orderError ? (
                    <div role="alert" aria-live="polite" className="mb-4 rounded-lg border border-red-500/40 px-4 py-3 text-sm text-red-300">
                      {orderError}{' '}
                      {orderError.toLowerCase().includes('cart') ? (
                        <button onClick={() => router.push('/cart')} className="underline">Go to cart</button>
                      ) : null}
                      {paymentPending ? (
                        <button onClick={() => router.push('/orders')} className="ml-2 underline">View My Orders</button>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="flex gap-4">
                    <button onClick={() => setCurrentStep(2)} disabled={placing}
                      className="flex-1 py-4 bg-dark-secondary border border-dark-border text-white rounded-lg font-medium hover:border-white transition-all disabled:opacity-50">
                      Back
                    </button>
                    <button onClick={handlePlaceOrder} disabled={placing || paymentPending || cartHasIssues || !selectedAddressId}
                      className="flex-1 py-4 bg-white text-black rounded-lg font-medium hover:bg-lighter-gray transition-all disabled:opacity-50">
                      {placing ? 'Opening Razorpay…' : paymentPending ? 'Payment verification pending' : `Pay securely · ${inr(finalTotal, 2)}`}
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
                    <div key={item.variantId} className="flex gap-4">
                      <div className="w-16 h-16 rounded-lg overflow-hidden bg-dark flex-shrink-0">
                        <img src={item.image || '/products/urban-tee.jpg'} alt={item.name} className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1">
                        <p className="text-white font-medium text-sm">{item.name}</p>
                        <p className="text-light-gray text-xs">
                          {item.size} · {item.color} · Qty {item.quantity}
                        </p>
                      </div>
                      <p className="text-white font-medium text-sm">{inr(item.lineTotal, 2)}</p>
                    </div>
                  ))}
                </div>

                {/* Coupon */}
                <div className="mb-6">
                  {coupon ? (
                    <div className="flex items-center justify-between rounded-lg border border-green-500/30 bg-green-500/10 px-3 py-2 text-sm">
                      <span className="text-green-400">{coupon.code} applied</span>
                      <button onClick={() => setCoupon(null)} className="text-light-gray underline hover:text-white">Remove</button>
                    </div>
                  ) : (
                    <>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={couponInput}
                          onChange={(e) => setCouponInput(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), applyCoupon())}
                          placeholder="Coupon code"
                          aria-label="Coupon code"
                          maxLength={40}
                          className="flex-1 min-w-0 px-3 py-2 bg-dark border border-dark-border rounded-lg text-sm text-white focus:outline-none focus:border-white"
                        />
                        <button onClick={applyCoupon} disabled={applyingCoupon || !couponInput.trim()}
                          className="px-4 py-2 bg-dark border border-dark-border text-white text-sm rounded-lg hover:border-white disabled:opacity-50">
                          Apply
                        </button>
                      </div>
                      {couponError ? <p role="alert" className="mt-2 text-xs text-red-300">{couponError}</p> : null}
                    </>
                  )}
                </div>

                <div className="border-t border-dark-border pt-4 space-y-3">
                  <div className="flex justify-between text-light-gray">
                    <span>Subtotal</span>
                    <span>{inr(cartTotal, 2)}</span>
                  </div>
                  {discount > 0 && (
                    <div className="flex justify-between text-green-400">
                      <span>Discount</span>
                      <span>−{inr(discount, 2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-light-gray">
                    <span>Delivery</span>
                    <span>{deliveryPrice === 0 ? <span className="text-green-400">FREE</span> : `₹${deliveryPrice}`}</span>
                  </div>
                  <div className="border-t border-dark-border pt-3 flex justify-between text-white text-xl font-bold">
                    <span>Total</span>
                    <span>{inr(finalTotal, 2)}</span>
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
