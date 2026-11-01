'use client';

import { motion } from 'framer-motion';
import { CheckCircle, Package, Home } from 'lucide-react';
import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function OrderSuccess() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderId = searchParams.get('orderId');

  return (
    <div className="bg-dark">

      <div className="pt-32 pb-20 px-4 flex items-center justify-center min-h-[70vh]">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="max-w-2xl w-full text-center"
        >
          {/* Success Icon */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-green-500/20 mb-8"
          >
            <CheckCircle className="w-16 h-16 text-green-500" />
          </motion.div>

          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Order Placed Successfully!
          </h1>
          <p className="text-light-gray text-lg mb-8">
            Thank you for your purchase
          </p>

          {/* Animated Image */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.6 }}
            className="mb-8"
          >
            <motion.img
              src="/products/jesus.jpg"
              alt="Order Success"
              className="w-full max-w-md mx-auto rounded-2xl shadow-2xl"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.6, duration: 0.8, type: "spring" }}
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
          </motion.div>

          {orderId && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
              className="text-light-gray mb-8"
            >
              Order ID: <span className="text-white font-mono">#{orderId}</span>
            </motion.p>
          )}

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1 }}
            className="bg-dark-secondary border border-dark-border rounded-xl p-8 mb-8"
          >
            <div className="flex items-start gap-4 text-left">
              <Package className="w-6 h-6 text-white flex-shrink-0 mt-1" />
              <div>
                <h3 className="text-white font-semibold mb-2">What's next?</h3>
                <p className="text-light-gray text-sm">
                  We've sent a confirmation email with your order details. 
                  You'll receive another email when your order ships.
                </p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2 }}
            className="flex gap-4 justify-center"
          >
            <button
              onClick={() => router.push('/')}
              className="px-8 py-3 bg-white text-black rounded-lg font-medium hover:bg-lighter-gray transition-all flex items-center gap-2"
            >
              <Home className="w-5 h-5" />
              Back to Home
            </button>
            <button
              onClick={() => router.push('/products')}
              className="px-8 py-3 bg-dark-secondary border border-dark-border text-white rounded-lg font-medium hover:border-white transition-all"
            >
              Continue Shopping
            </button>
          </motion.div>
        </motion.div>
      </div>

    </div>
  );
}

// useSearchParams() must sit inside a Suspense boundary for static builds
export default function OrderSuccessPage() {
  return (
    <Suspense fallback={<div className="min-h-[70vh]" />}>
      <OrderSuccess />
    </Suspense>
  );
}