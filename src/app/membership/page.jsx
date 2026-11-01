'use client';

import { motion } from 'framer-motion';
import { Check, Crown, Star, Zap } from 'lucide-react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { membershipPlans } from '@/data/products';
import { useAuth } from '@/context/AuthContext';

function Membership() {
  const router = useRouter();
  const { user, isLoggedIn, updateMembership } = useAuth();
  const [selectedPlan, setSelectedPlan] = useState(null);

  const handleSubscribe = (planId) => {
    if (!isLoggedIn) {
      alert('Please login to subscribe');
      // In real app, redirect to login
      return;
    }

    // Mock subscription
    updateMembership(planId);
    alert(`Successfully subscribed to ${planId.toUpperCase()} plan!`);
    router.push('/');
  };

  const getPlanIcon = (planId) => {
    switch (planId) {
      case 'basic':
        return Star;
      case 'premium':
        return Crown;
      case 'vip':
        return Zap;
      default:
        return Star;
    }
  };

  return (
    <div className="bg-dark">

      <div className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-16"
          >
            <h1 className="text-5xl md:text-6xl font-bold text-white mb-4">
              Choose Your Plan
            </h1>
            <p className="text-light-gray text-lg max-w-2xl mx-auto">
              Unlock exclusive benefits and save more with our membership plans
            </p>
          </motion.div>

          {/* Membership Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
            {membershipPlans.map((plan, index) => {
              const Icon = getPlanIcon(plan.id);
              const isRecommended = plan.recommended;

              return (
                <motion.div
                  key={plan.id}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.2 }}
                  className={`relative bg-dark-secondary rounded-2xl overflow-hidden ${
                    isRecommended
                      ? 'border-2 border-white'
                      : 'border border-dark-border'
                  }`}
                >
                  {/* Recommended Badge */}
                  {isRecommended && (
                    <div className="absolute top-0 right-0 bg-white text-black px-4 py-1 text-sm font-bold">
                      MOST LOVED
                    </div>
                  )}

                  <div className="p-8">
                    {/* Icon */}
                    <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center mb-6">
                      <Icon className="w-8 h-8 text-white" />
                    </div>

                    {/* Plan Name */}
                    <h3 className="text-2xl font-bold text-white mb-2">
                      {plan.name}
                    </h3>

                    {/* Price */}
                    <div className="mb-6">
                      <span className="text-4xl font-bold text-white">
                        ₹{plan.price}
                      </span>
                      <span className="text-light-gray">/{plan.period}</span>
                    </div>

                    {/* Discount Badge */}
                    <div className="inline-block px-4 py-2 bg-green-500/20 rounded-full mb-6">
                      <span className="text-green-400 font-semibold">
                        {plan.discount}% OFF on all products
                      </span>
                    </div>

                    {/* Features */}
                    <ul className="space-y-4 mb-8">
                      {plan.features.map((feature, idx) => (
                        <li key={idx} className="flex items-start gap-3">
                          <Check className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                          <span className="text-light-gray">{feature}</span>
                        </li>
                      ))}
                    </ul>

                    {/* Subscribe Button */}
                    <button
                      onClick={() => handleSubscribe(plan.id)}
                      className={`w-full py-4 rounded-lg font-medium transition-all ${
                        isRecommended
                          ? 'bg-white text-black hover:bg-lighter-gray'
                          : 'bg-dark-secondary border-2 border-white text-white hover:bg-white hover:text-black'
                      }`}
                    >
                      Subscribe Now
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Benefits Section */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-dark-secondary border border-dark-border rounded-2xl p-8 md:p-12"
          >
            <h2 className="text-3xl font-bold text-white mb-8 text-center">
              Why Join Our Membership?
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="flex gap-4">
                <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                  <Check className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-white mb-2">
                    Exclusive Discounts
                  </h3>
                  <p className="text-light-gray">
                    Save up to 30% on every purchase with our VIP membership
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                  <Check className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-white mb-2">
                    Free Shipping
                  </h3>
                  <p className="text-light-gray">
                    Enjoy free delivery on all orders, no minimum purchase required
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                  <Check className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-white mb-2">
                    Early Access
                  </h3>
                  <p className="text-light-gray">
                    Be the first to shop new collections and limited editions
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                  <Check className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-white mb-2">
                    Priority Support
                  </h3>
                  <p className="text-light-gray">
                    Get 24/7 dedicated support from our premium team
                  </p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* FAQ Section */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mt-16"
          >
            <h2 className="text-3xl font-bold text-white mb-8 text-center">
              Frequently Asked Questions
            </h2>

            <div className="space-y-4 max-w-3xl mx-auto">
              <details className="bg-dark-secondary border border-dark-border rounded-xl p-6 cursor-pointer">
                <summary className="text-white font-semibold cursor-pointer">
                  Can I cancel my membership anytime?
                </summary>
                <p className="text-light-gray mt-4">
                  Yes, you can cancel your membership at any time. Your benefits will remain active until the end of your current billing period.
                </p>
              </details>

              <details className="bg-dark-secondary border border-dark-border rounded-xl p-6 cursor-pointer">
                <summary className="text-white font-semibold cursor-pointer">
                  Do membership discounts stack with sales?
                </summary>
                <p className="text-light-gray mt-4">
                  Yes! Your membership discount applies on top of any ongoing sales, giving you even better value.
                </p>
              </details>

              <details className="bg-dark-secondary border border-dark-border rounded-xl p-6 cursor-pointer">
                <summary className="text-white font-semibold cursor-pointer">
                  Is free shipping available internationally?
                </summary>
                <p className="text-light-gray mt-4">
                  Free shipping is available for all Premium and VIP members. VIP members also get express shipping worldwide.
                </p>
              </details>

              <details className="bg-dark-secondary border border-dark-border rounded-xl p-6 cursor-pointer">
                <summary className="text-white font-semibold cursor-pointer">
                  Can I upgrade my membership later?
                </summary>
                <p className="text-light-gray mt-4">
                  Absolutely! You can upgrade to a higher tier at any time and only pay the difference.
                </p>
              </details>
            </div>
          </motion.div>
        </div>
      </div>

    </div>
  );
}

export default Membership;