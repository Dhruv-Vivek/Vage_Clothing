'use client';

import { useEffect, useState, Suspense } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, Clock, XCircle, Package, Home, Mail, RefreshCw } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';

function formatPrice(value) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function OrderSuccess() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderId = searchParams.get('orderId');
  const [orderData, setOrderData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailMessage, setEmailMessage] = useState('');

  useEffect(() => {
    if (!orderId) {
      setLoading(false);
      setLoadError('An order ID was not provided.');
      return undefined;
    }

    let cancelled = false;
    let timer;
    let attempts = 0;

    async function refreshOrder() {
      try {
        const response = await fetch(`/api/orders/${encodeURIComponent(orderId)}`, {
          cache: 'no-store',
          credentials: 'same-origin',
        });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || 'Unable to load order status.');
        if (cancelled) return;

        setOrderData(body);
        setLoadError('');
        setLoading(false);

        if (body.order?.payment_status === 'PENDING' && attempts < 10) {
          attempts += 1;
          timer = setTimeout(refreshOrder, 2500);
        }
      } catch (error) {
        if (!cancelled) {
          setLoadError(error.message || 'Unable to load order status.');
          setLoading(false);
        }
      }
    }

    refreshOrder();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [orderId]);

  const resendEmails = async () => {
    if (!orderId) return;
    setEmailBusy(true);
    setEmailMessage('');
    try {
      const response = await fetch(`/api/orders/${encodeURIComponent(orderId)}/emails`, {
        method: 'POST',
        credentials: 'same-origin',
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Unable to resend email.');
      setEmailMessage('Email retry has been processed. Refresh shortly to see delivery status.');
      const refresh = await fetch(`/api/orders/${encodeURIComponent(orderId)}`, { cache: 'no-store' });
      if (refresh.ok) setOrderData(await refresh.json());
    } catch (error) {
      setEmailMessage(error.message || 'Email could not be resent.');
    } finally {
      setEmailBusy(false);
    }
  };

  const order = orderData?.order;
  const paid = order?.payment_status === 'PAID';
  const failed = order?.payment_status === 'FAILED';
  const Icon = paid ? CheckCircle : failed ? XCircle : Clock;
  const statusColor = paid ? 'text-green-400' : failed ? 'text-red-400' : 'text-amber-300';
  const heading = paid ? 'Payment Confirmed' : failed ? 'Payment Not Completed' : 'Confirming Your Payment';
  const description = paid
    ? 'Your payment has been verified and your order is confirmed.'
    : failed
      ? 'The payment was not completed. Your order has been cancelled and reserved stock was released.'
      : 'Razorpay has returned you to VAGE. We are checking the payment status with the server. Please do not pay again while this check is pending.';

  return (
    <div className="bg-dark">
      <div className="pt-32 pb-20 px-4 flex items-center justify-center min-h-[70vh]">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="max-w-3xl w-full text-center"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-white/5 mb-8"
          >
            <Icon className={`w-16 h-16 ${statusColor}`} />
          </motion.div>

          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            {loading ? 'Loading Order…' : loadError ? 'Order Status Unavailable' : heading}
          </h1>
          <p className="text-light-gray text-lg mb-8">
            {loadError || (order ? description : 'Retrieving your order information.')}
          </p>

          {loading && (
            <div className="flex justify-center mb-8">
              <RefreshCw className="w-6 h-6 text-light-gray animate-spin" />
            </div>
          )}

          {order && (
            <div className="bg-dark-secondary border border-dark-border rounded-xl p-8 mb-8 text-left">
              <div className="flex flex-wrap justify-between gap-3 mb-6">
                <div>
                  <p className="text-light-gray text-xs uppercase tracking-wider">Order number</p>
                  <p className="text-white font-mono text-lg">{order.order_number}</p>
                </div>
                <div className="text-right">
                  <p className="text-light-gray text-xs uppercase tracking-wider">Payment status</p>
                  <p className={`font-semibold ${statusColor}`}>{order.payment_status}</p>
                </div>
              </div>

              <div className="space-y-3 mb-6">
                {orderData.items.map((item, index) => (
                  <div key={`${item.sku}-${index}`} className="flex justify-between gap-4 border-b border-dark-border pb-3">
                    <div>
                      <p className="text-white font-medium">{item.product_name}</p>
                      <p className="text-light-gray text-sm">{item.size} · {item.color} · Qty {item.quantity}</p>
                    </div>
                    <p className="text-white">{formatPrice(item.line_total)}</p>
                  </div>
                ))}
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-light-gray"><span>Subtotal</span><span>{formatPrice(order.subtotal)}</span></div>
                <div className="flex justify-between text-light-gray"><span>Discounts</span><span>− {formatPrice(order.discount_amount)}</span></div>
                <div className="flex justify-between text-light-gray"><span>Delivery</span><span>{formatPrice(order.shipping_amount)}</span></div>
                <div className="flex justify-between text-white text-xl font-bold border-t border-dark-border pt-3 mt-3">
                  <span>Total</span><span>{formatPrice(order.total_amount)}</span>
                </div>
              </div>

              {paid && (
                <div className="mt-8 border-t border-dark-border pt-6">
                  <div className="flex items-start gap-3">
                    <Mail className="w-5 h-5 text-white flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-white font-semibold mb-2">Order emails</p>
                      {orderData.emailDelivery?.length ? (
                        <div className="space-y-1">
                          {orderData.emailDelivery.map((email) => (
                            <p className="text-light-gray text-sm" key={email.event_type}>
                              {email.event_type === 'PAYMENT_RECEIPT' ? 'Payment receipt' : 'Order confirmation'}: {email.status}
                            </p>
                          ))}
                        </div>
                      ) : (
                        <p className="text-light-gray text-sm">Order email is queued after payment verification.</p>
                      )}
                      <button
                        onClick={resendEmails}
                        disabled={emailBusy}
                        className="mt-3 text-white text-sm underline disabled:opacity-50"
                      >
                        {emailBusy ? 'Retrying…' : 'Retry order emails'}
                      </button>
                      {emailMessage && <p className="text-light-gray text-xs mt-2">{emailMessage}</p>}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-dark-secondary border border-dark-border rounded-xl p-8 mb-8 text-left"
          >
            <div className="flex items-start gap-4">
              <Package className="w-6 h-6 text-white flex-shrink-0 mt-1" />
              <div>
                <h3 className="text-white font-semibold mb-2">What happens next?</h3>
                <p className="text-light-gray text-sm">
                  {paid
                    ? 'Your order is recorded in VAGE. The order confirmation and payment receipt are delivered to your account email when the email provider is configured.'
                    : failed
                      ? 'Return to your cart and try checkout again when you are ready.'
                      : 'This page checks the order status for a short period. You can safely return later and check this order again.'}
                </p>
              </div>
            </div>
          </motion.div>

          <div className="flex gap-4 justify-center flex-wrap">
            <button
              onClick={() => router.push('/')}
              className="px-8 py-3 bg-white text-black rounded-lg font-medium hover:bg-lighter-gray transition-all flex items-center gap-2"
            >
              <Home className="w-5 h-5" />
              Back to Home
            </button>
            <button
              onClick={() => router.push(failed ? '/cart' : '/products')}
              className="px-8 py-3 bg-dark-secondary border border-dark-border text-white rounded-lg font-medium hover:border-white transition-all"
            >
              {failed ? 'Return to Cart' : 'Continue Shopping'}
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

export default function OrderSuccessPage() {
  return (
    <Suspense fallback={<div className="min-h-[70vh]" />}>
      <OrderSuccess />
    </Suspense>
  );
}
