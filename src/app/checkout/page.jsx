'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { MapPin, Truck, CreditCard, Check, AlertCircle, ShieldCheck } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { deliveryOptions } from '@/data/products';

const INDIA_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya',
  'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim',
  'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand',
  'West Bengal', 'Andaman and Nicobar Islands', 'Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu', 'Delhi',
  'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry',
];

function formatPrice(value) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function loadRazorpayScript() {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('Payment checkout is only available in a browser.'));
      return;
    }
    if (window.Razorpay) {
      resolve(true);
      return;
    }

    const existing = document.querySelector('script[data-vage-razorpay="true"]');
    if (existing) {
      existing.addEventListener('load', () => resolve(true), { once: true });
      existing.addEventListener('error', () => reject(new Error('Unable to load Razorpay Checkout.')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.dataset.vageRazorpay = 'true';
    script.onload = () => resolve(true);
    script.onerror = () => reject(new Error('Unable to load Razorpay Checkout. Check your internet connection.'));
    document.body.appendChild(script);
  });
}

function Checkout() {
  const router = useRouter();
  const { cartItems, cartTotal, clearCart, isCartLoaded } = useCart();
  const { user, isLoggedIn, isLoading } = useAuth();

  const [currentStep, setCurrentStep] = useState(1);
  const [shippingInfo, setShippingInfo] = useState({
    fullName: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
  });
  const [selectedDelivery, setSelectedDelivery] = useState('standard');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [paymentMessage, setPaymentMessage] = useState('');

  const orderPlaced = useRef(false);
  const idempotencyKey = useRef(null);
  const dismissHandled = useRef(false);

  useEffect(() => {
    if (!user) return;
    setShippingInfo((current) => ({
      ...current,
      fullName: current.fullName || user.name || '',
      phone: current.phone || (() => {
        const digits = String(user.phone || '').replace(/\D/g, '');
        return digits.startsWith('91') && digits.length === 12 ? digits.slice(2) : digits.slice(-10);
      })(),
    }));
  }, [user]);

  useEffect(() => {
    if (isCartLoaded && cartItems.length === 0 && !orderPlaced.current) {
      router.replace('/cart');
    }
  }, [isCartLoaded, cartItems.length, router]);

  if (!isCartLoaded || isLoading || cartItems.length === 0) return null;

  const hasMissingVariant = cartItems.some((item) => !Number.isSafeInteger(Number(item.variantId)));
  const delivery = deliveryOptions.find((option) => option.id === selectedDelivery) || deliveryOptions[0];
  const estimatedTotal = cartTotal + Number(delivery.price || 0);

  const updateShipping = (field, value) => {
    setShippingInfo((current) => ({ ...current, [field]: value }));
  };

  const handleShippingSubmit = (event) => {
    event.preventDefault();
    setErrorMessage('');

    if (!isLoggedIn) {
      setErrorMessage('Please sign in before continuing to payment.');
      return;
    }
    if (hasMissingVariant) {
      setErrorMessage('Your cart contains an older item without a selected size and colour. Remove it and add it again from the product page.');
      return;
    }
    if (!/^[0-9]{10}$/.test(shippingInfo.phone)) {
      setErrorMessage('Enter a valid 10-digit Indian mobile number.');
      return;
    }
    if (!/^[0-9]{6}$/.test(shippingInfo.pincode)) {
      setErrorMessage('Enter a valid 6-digit PIN code.');
      return;
    }
    setCurrentStep(2);
  };

  const handleDeliverySubmit = () => {
    setErrorMessage('');
    setCurrentStep(3);
  };

  const reconcileAbandonedCheckout = async (orderId, razorpayOrderId) => {
    if (dismissHandled.current) return;
    dismissHandled.current = true;

    try {
      const response = await fetch('/api/payments/abandon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ orderId, razorpayOrderId }),
      });
      const result = await response.json().catch(() => ({}));

      if (result.paymentStatus === 'PAID' || result.paymentStatus === 'PENDING') {
        orderPlaced.current = true;
        clearCart();
        router.push(`/order-success?orderId=${orderId}`);
        return;
      }

      if (!response.ok) {
        setErrorMessage(result.error || 'We could not reconcile the payment yet. Do not retry until you check the order status.');
      } else {
        setErrorMessage('Payment was not completed. Your cart is still available; you can try again.');
      }
    } catch {
      setErrorMessage('We could not confirm the payment status. Please do not pay again until the order status is checked.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePlaceOrder = async () => {
    setErrorMessage('');
    setPaymentMessage('');

    if (!isLoggedIn) {
      setErrorMessage('Please sign in before checkout.');
      return;
    }
    if (hasMissingVariant) {
      setErrorMessage('Please remove older cart items and re-add them after selecting a size and colour.');
      return;
    }
    if (!/^[0-9]{10}$/.test(shippingInfo.phone) || !/^[0-9]{6}$/.test(shippingInfo.pincode)) {
      setErrorMessage('Please complete your valid 10-digit phone number and 6-digit PIN code.');
      setCurrentStep(1);
      return;
    }

    setIsProcessing(true);
    dismissHandled.current = false;

    try {
      await loadRazorpayScript();

      if (!idempotencyKey.current) {
        idempotencyKey.current = window.crypto.randomUUID();
      }

      const createResponse = await fetch('/api/checkout/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        cache: 'no-store',
        body: JSON.stringify({
          idempotencyKey: idempotencyKey.current,
          items: cartItems.map((item) => ({
            variantId: Number(item.variantId),
            quantity: Number(item.quantity),
          })),
          shippingInfo,
          deliveryMethod: selectedDelivery,
        }),
      });

      const checkout = await createResponse.json().catch(() => ({}));
      if (!createResponse.ok) {
        if (createResponse.status === 409) idempotencyKey.current = null;
        throw new Error(checkout.error || 'Unable to prepare your order.');
      }

      // Once the backend has created the gateway order, a retry must use a new
      // checkout identity so a failed/cancelled attempt is not reused.
      idempotencyKey.current = null;

      const options = {
        key: checkout.keyId,
        amount: checkout.amount,
        currency: checkout.currency,
        name: 'VAGE',
        description: `Order ${checkout.orderNumber}`,
        order_id: checkout.razorpayOrderId,
        prefill: {
          name: shippingInfo.fullName,
          email: user?.email || '',
          contact: `+91${shippingInfo.phone}`,
        },
        notes: { order_number: checkout.orderNumber },
        theme: { color: '#111111' },
        handler: async (response) => {
          dismissHandled.current = true;
          setPaymentMessage('Payment received by Razorpay. Verifying it securely…');

          try {
            const verifyResponse = await fetch('/api/payments/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'same-origin',
              cache: 'no-store',
              body: JSON.stringify({
                orderId: checkout.orderId,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              }),
            });
            const verification = await verifyResponse.json().catch(() => ({}));

            if (
              verifyResponse.ok ||
              verifyResponse.status === 202 ||
              verifyResponse.status >= 500
            ) {
              orderPlaced.current = true;
              clearCart();
              router.push(`/order-success?orderId=${checkout.orderId}`);
              return;
            }

            // Reconcile against Razorpay's live payment list before allowing
            // another checkout attempt. A browser callback alone is not proof
            // that this order failed or succeeded.
            dismissHandled.current = false;
            await reconcileAbandonedCheckout(checkout.orderId, checkout.razorpayOrderId);
          } catch {
            // Razorpay has returned a signed success callback. Avoid asking the
            // customer to pay twice; the webhook and order page can reconcile it.
            orderPlaced.current = true;
            clearCart();
            router.push(`/order-success?orderId=${checkout.orderId}`);
          } finally {
            setIsProcessing(false);
          }
        },
        modal: {
          ondismiss: () => reconcileAbandonedCheckout(checkout.orderId, checkout.razorpayOrderId),
          escape: true,
          confirm_close: true,
        },
      };

      const razorpay = new window.Razorpay(options);
      razorpay.on('payment.failed', () => {
        setPaymentMessage('This payment attempt did not complete. You can retry from the Razorpay window; your order will remain pending until the checkout window is closed.');
      });
      razorpay.open();
    } catch (error) {
      setIsProcessing(false);
      setErrorMessage(error?.message || 'Unable to start payment. Please try again.');
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
                        className={`w-12 h-12 rounded-full flex items-center justify-center border-2 ${
                          isActive ? 'bg-white text-black border-white' : 'bg-dark-secondary text-light-gray border-dark-border'
                        }`}
                      >
                        {isCompleted ? <Check className="w-6 h-6" /> : <Icon className="w-6 h-6" />}
                      </motion.div>
                      <p className={`mt-2 text-sm font-medium ${isActive ? 'text-white' : 'text-light-gray'}`}>
                        {step.name}
                      </p>
                    </div>
                    {index < steps.length - 1 && (
                      <div className={`w-24 h-0.5 mx-4 ${currentStep > step.number ? 'bg-white' : 'bg-dark-border'}`} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {errorMessage && (
            <div className="mb-6 max-w-7xl mx-auto rounded-lg border border-red-500/40 bg-red-500/10 p-4 flex gap-3">
              <AlertCircle className="w-5 h-5 text-red-300 flex-shrink-0" />
              <p className="text-red-100 text-sm">{errorMessage}</p>
            </div>
          )}
          {paymentMessage && (
            <div className="mb-6 max-w-7xl mx-auto rounded-lg border border-blue-400/30 bg-blue-400/10 p-4">
              <p className="text-blue-100 text-sm">{paymentMessage}</p>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              {currentStep === 1 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-dark-secondary border border-dark-border rounded-xl p-8"
                >
                  <h2 className="text-2xl font-bold text-white mb-6">Shipping Information</h2>
                  <form onSubmit={handleShippingSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-white mb-2">Full Name *</label>
                        <input
                          type="text"
                          required
                          maxLength={120}
                          value={shippingInfo.fullName}
                          onChange={(event) => updateShipping('fullName', event.target.value)}
                          className="w-full px-4 py-3 bg-dark border border-dark-border rounded-lg text-white focus:outline-none focus:border-white"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-white mb-2">Email</label>
                        <input
                          type="email"
                          value={user?.email || ''}
                          readOnly
                          className="w-full px-4 py-3 bg-dark border border-dark-border rounded-lg text-light-gray"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-white mb-2">Phone Number *</label>
                      <div className="flex">
                        <span className="px-4 py-3 bg-dark-secondary border border-dark-border border-r-0 rounded-l-lg text-white">+91</span>
                        <input
                          type="tel"
                          required
                          inputMode="numeric"
                          autoComplete="tel-national"
                          maxLength={10}
                          pattern="[0-9]{10}"
                          value={shippingInfo.phone}
                          onChange={(event) => updateShipping('phone', event.target.value.replace(/\D/g, '').slice(0, 10))}
                          placeholder="10-digit mobile number"
                          className="w-full px-4 py-3 bg-dark border border-dark-border rounded-r-lg text-white focus:outline-none focus:border-white"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-white mb-2">Address *</label>
                      <textarea
                        required
                        rows="3"
                        maxLength={200}
                        value={shippingInfo.address}
                        onChange={(event) => updateShipping('address', event.target.value)}
                        className="w-full px-4 py-3 bg-dark border border-dark-border rounded-lg text-white focus:outline-none focus:border-white"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-white mb-2">City / District *</label>
                        <input
                          type="text"
                          required
                          maxLength={100}
                          value={shippingInfo.city}
                          onChange={(event) => updateShipping('city', event.target.value)}
                          className="w-full px-4 py-3 bg-dark border border-dark-border rounded-lg text-white focus:outline-none focus:border-white"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-white mb-2">State / UT *</label>
                        <select
                          required
                          value={shippingInfo.state}
                          onChange={(event) => updateShipping('state', event.target.value)}
                          className="w-full px-4 py-3 bg-dark border border-dark-border rounded-lg text-white focus:outline-none focus:border-white"
                        >
                          <option value="">Select state</option>
                          {INDIA_STATES.map((state) => <option key={state} value={state}>{state}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-white mb-2">PIN Code *</label>
                        <input
                          type="text"
                          required
                          inputMode="numeric"
                          pattern="[0-9]{6}"
                          maxLength={6}
                          value={shippingInfo.pincode}
                          onChange={(event) => updateShipping('pincode', event.target.value.replace(/\D/g, '').slice(0, 6))}
                          className="w-full px-4 py-3 bg-dark border border-dark-border rounded-lg text-white focus:outline-none focus:border-white"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={hasMissingVariant}
                      className="w-full py-4 bg-white text-black rounded-lg font-medium hover:bg-lighter-gray transition-all disabled:opacity-40"
                    >
                      Continue to Delivery
                    </button>
                  </form>
                </motion.div>
              )}

              {currentStep === 2 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-dark-secondary border border-dark-border rounded-xl p-8"
                >
                  <h2 className="text-2xl font-bold text-white mb-6">Choose Delivery Option</h2>
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
                              onChange={(event) => setSelectedDelivery(event.target.value)}
                              className="w-5 h-5"
                            />
                            <div>
                              <p className="text-white font-semibold">{option.name}</p>
                              <p className="text-light-gray text-sm">Estimated delivery: {option.days}</p>
                            </div>
                          </div>
                          <p className="text-white font-bold">₹{option.price}</p>
                        </div>
                      </label>
                    ))}
                  </div>

                  <p className="text-light-gray text-sm mt-5">
                    Any active membership discount or shipping benefit is checked against MySQL during order creation. The Razorpay amount is calculated on the server.
                  </p>

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

              {currentStep === 3 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-dark-secondary border border-dark-border rounded-xl p-8"
                >
                  <h2 className="text-2xl font-bold text-white mb-6">Secure Payment</h2>
                  <div className="p-6 bg-dark border border-dark-border rounded-lg mb-6">
                    <div className="flex items-start gap-3">
                      <ShieldCheck className="w-6 h-6 text-green-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-white font-semibold mb-2">Powered by Razorpay</p>
                        <p className="text-light-gray text-sm">
                          Pay using the payment methods enabled in Razorpay Checkout. Your order is confirmed only after the server verifies a captured payment.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <button
                      onClick={() => setCurrentStep(2)}
                      disabled={isProcessing}
                      className="flex-1 py-4 bg-dark-secondary border border-dark-border text-white rounded-lg font-medium hover:border-white transition-all disabled:opacity-40"
                    >
                      Back
                    </button>
                    <button
                      onClick={handlePlaceOrder}
                      disabled={isProcessing || hasMissingVariant}
                      className="flex-1 py-4 bg-white text-black rounded-lg font-medium hover:bg-lighter-gray transition-all disabled:opacity-50"
                    >
                      {isProcessing ? 'Preparing secure payment…' : `Pay ${formatPrice(estimatedTotal)} (estimate)`}
                    </button>
                  </div>
                  <p className="text-light-gray text-xs mt-4">
                    The amount shown here is an estimate. The final price, stock, membership discount and delivery fee are recalculated by the server before Razorpay opens.
                  </p>
                </motion.div>
              )}
            </div>

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
                        <img src={item.image || '/products/urban-tee.jpg'} alt={item.name} className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-medium text-sm">{item.name}</p>
                        <p className="text-light-gray text-xs">{item.size || 'Variant required'} · {item.color || 'Choose colour'}</p>
                        <p className="text-light-gray text-xs">Qty: {item.quantity}</p>
                      </div>
                      <p className="text-white font-medium text-sm">
                        {formatPrice(Number(item.unitPrice || 0) * Number(item.quantity || 0))}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="border-t border-dark-border pt-4 space-y-3">
                  <div className="flex justify-between text-light-gray">
                    <span>Subtotal estimate</span>
                    <span>{formatPrice(cartTotal)}</span>
                  </div>
                  <div className="flex justify-between text-light-gray">
                    <span>Delivery estimate</span>
                    <span>₹{delivery.price}</span>
                  </div>
                  <div className="border-t border-dark-border pt-3 flex justify-between text-white text-xl font-bold">
                    <span>Estimate</span>
                    <span>{formatPrice(estimatedTotal)}</span>
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
