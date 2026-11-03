'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Crown, Star, Zap, ShieldCheck, RefreshCw, CalendarDays, AlertCircle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
}

function formatPrice(value) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(value || 0));
}

function loadRazorpayScript() {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('Membership payment is only available in a browser.'));
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

const icons = { basic: Star, premium: Crown, vip: Zap };

export default function Membership() {
  const { user, isLoggedIn, isLoading: authLoading, refresh } = useAuth();
  const [plans, setPlans] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busyPlan, setBusyPlan] = useState('');
  const [message, setMessage] = useState(null);

  const loadMembership = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/membership', { cache: 'no-store', credentials: 'same-origin' });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'Unable to load membership plans.');
      setPlans(body.plans || []);
      setSummary(body.summary || null);
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'Unable to load membership information.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMembership();
  }, [loadMembership]);

  const finishPayment = async (purchase, response) => {
    const verify = await fetch('/api/membership/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      cache: 'no-store',
      body: JSON.stringify({
        purchaseId: purchase.purchaseId,
        razorpay_order_id: response.razorpay_order_id,
        razorpay_payment_id: response.razorpay_payment_id,
        razorpay_signature: response.razorpay_signature,
      }),
    });
    const result = await verify.json().catch(() => ({}));
    if (verify.status === 202) {
      setMessage({ type: 'pending', text: result.message || 'Payment is awaiting capture. Your membership is not active yet.' });
      await loadMembership();
      return;
    }
    if (!verify.ok) throw new Error(result.error || 'Unable to verify the membership payment.');
    setMessage({ type: 'success', text: 'Payment captured. Your membership is now active.' });
    await refresh();
    await loadMembership();
  };

  const startPurchase = async (plan) => {
    if (authLoading) return;
    if (!isLoggedIn) {
      setMessage({ type: 'error', text: 'Please sign in before purchasing a membership.' });
      return;
    }
    setBusyPlan(plan.code);
    setMessage(null);
    let purchaseSession = null;

    try {
      const response = await fetch('/api/membership/purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        cache: 'no-store',
        body: JSON.stringify({ planCode: plan.code, idempotencyKey: crypto.randomUUID() }),
      });
      const purchase = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(purchase.error || 'Unable to start membership purchase.');
      purchaseSession = purchase;

      await loadRazorpayScript();
      const checkout = new window.Razorpay({
        key: purchase.keyId,
        amount: purchase.amount,
        currency: purchase.currency || 'INR',
        name: 'VAGE Clothing',
        description: plan.name + ' Membership',
        order_id: purchase.razorpayOrderId,
        prefill: {
          name: user?.name || '',
          email: user?.email || '',
          contact: user?.phone || '',
        },
        theme: { color: '#111111' },
        handler: async (paymentResponse) => {
          try {
            await finishPayment(purchase, paymentResponse);
          } catch (error) {
            setMessage({ type: 'error', text: error.message || 'Payment verification is pending. Check membership status before retrying.' });
            await loadMembership();
          } finally {
            setBusyPlan('');
          }
        },
        modal: {
          ondismiss: async () => {
            try {
              const abandoned = await fetch('/api/membership/abandon', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin',
                cache: 'no-store',
                body: JSON.stringify({ purchaseId: purchase.purchaseId }),
              });
              const result = await abandoned.json().catch(() => ({}));
              if (result.paymentStatus === 'PAID') {
                setMessage({ type: 'success', text: 'Payment was captured before checkout closed. Your membership is active.' });
                await refresh();
              } else if (result.paymentStatus === 'PENDING') {
                setMessage({ type: 'pending', text: result.message || 'Payment is authorised and awaiting capture.' });
              } else if (!abandoned.ok) {
                setMessage({ type: 'error', text: result.error || 'Unable to reconcile membership payment. Check status before retrying.' });
              } else {
                setMessage({ type: 'error', text: 'Membership checkout closed before payment capture. No membership was activated.' });
              }
              await loadMembership();
            } catch {
              setMessage({ type: 'error', text: 'Unable to reconcile the closed checkout. Refresh membership status before trying again.' });
            } finally {
              setBusyPlan('');
            }
          },
        },
      });
      checkout.on('payment.failed', () => {
        setMessage({ type: 'pending', text: 'This payment attempt failed. You can retry inside Razorpay Checkout; membership is activated only after capture.' });
      });
      checkout.open();
    } catch (error) {
      let messageText = error.message || 'Unable to start payment. Please try again.';
      if (purchaseSession?.purchaseId) {
        try {
          const reconciled = await fetch('/api/membership/abandon', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            cache: 'no-store',
            body: JSON.stringify({ purchaseId: purchaseSession.purchaseId }),
          });
          const result = await reconciled.json().catch(() => ({}));
          if (!reconciled.ok) {
            messageText += ' We could not reconcile the created payment session; check membership status before trying again.';
          } else if (result.paymentStatus === 'PAID') {
            messageText = 'Payment was captured before checkout could finish. Your membership is active.';
            await refresh();
          } else if (result.paymentStatus === 'PENDING') {
            messageText = result.message || 'Payment is authorised and awaiting capture. Check its status before starting another purchase.';
          } else {
            messageText += ' The incomplete payment session was closed and no membership was activated.';
          }
          await loadMembership();
        } catch {
          messageText += ' Payment status could not be reconciled. Check membership status before trying again.';
        }
      }
      setMessage({ type: 'error', text: messageText });
      setBusyPlan('');
    }
  };

  const current = summary?.current;
  const queued = summary?.queued;
  const pendingPayments = (summary?.payments || []).filter((payment) =>
    ['CREATED', 'AUTHORIZED'].includes(String(payment.status).toUpperCase())
  );

  const reconcilePendingPayment = async (payment) => {
    setBusyPlan('reconcile');
    setMessage(null);
    try {
      const response = await fetch('/api/membership/abandon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        cache: 'no-store',
        body: JSON.stringify({ purchaseId: payment.paymentId }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Unable to check this payment.');
      if (result.paymentStatus === 'PAID') {
        setMessage({ type: 'success', text: 'Payment captured. Your membership is active.' });
        await refresh();
      } else if (result.paymentStatus === 'PENDING') {
        setMessage({ type: 'pending', text: result.message || 'Payment is authorised and awaiting capture.' });
      } else {
        setMessage({ type: 'error', text: 'Payment was not captured. You can start a new membership purchase.' });
      }
      await loadMembership();
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'Unable to reconcile payment.' });
    } finally {
      setBusyPlan('');
    }
  };

  return (
    <div className="min-h-screen bg-dark">
      <div className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-14">
            <p className="text-light-gray text-xs tracking-[0.35em] mb-4">THE VAGE MEMBERSHIP</p>
            <h1 className="text-5xl md:text-6xl font-bold text-white mb-4">Choose Your Plan</h1>
            <p className="text-light-gray text-lg max-w-2xl mx-auto">
              Member pricing and benefits are loaded from VAGE's database and applied at checkout.
            </p>
          </motion.div>

          {message && (
            <div role="status" className={'mb-8 max-w-4xl mx-auto rounded-xl border p-4 flex gap-3 ' +
              (message.type === 'success' ? 'border-green-500/30 bg-green-500/10 text-green-100' :
                message.type === 'pending' ? 'border-amber-500/30 bg-amber-500/10 text-amber-100' :
                  'border-red-500/30 bg-red-500/10 text-red-100')}>
              <AlertCircle className="h-5 w-5 shrink-0" />
              <p className="text-sm">{message.text}</p>
            </div>
          )}

          {!authLoading && isLoggedIn && current && (
            <section className="mb-10 rounded-2xl border border-green-500/30 bg-green-500/5 p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs tracking-[0.2em] text-green-300">YOUR ACTIVE MEMBERSHIP</p>
                  <h2 className="mt-1 text-2xl font-semibold text-white">{current.name}</h2>
                  <p className="mt-1 text-sm text-light-gray">
                    {current.discountPercent}% product discount · Expires {formatDate(current.expiresAt)} · {current.daysLeft} days left
                  </p>
                </div>
                <div className="rounded-lg border border-green-500/30 px-4 py-2 text-sm text-green-200">
                  <ShieldCheck className="mr-2 inline h-4 w-4" /> Active
                </div>
              </div>
              {queued && (
                <div className="mt-5 flex flex-col gap-3 border-t border-dark-border pt-5 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-light-gray">Next {queued.name} term begins {formatDate(queued.startsAt)}.</p>
                  <span className="text-xs text-light-gray">This renewal is already paid and will begin automatically on the displayed date.</span>
                </div>
              )}
            </section>
          )}

          {isLoggedIn && pendingPayments.length > 0 && (
            <section className="mb-10 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-6">
              <h2 className="text-lg font-semibold text-white">Payment needs confirmation</h2>
              <p className="mt-2 text-sm text-light-gray">A previous membership payment is not final yet. Check its status before starting another purchase.</p>
              <div className="mt-5 space-y-3">
                {pendingPayments.map((payment) => (
                  <div key={payment.paymentId} className="flex flex-col gap-3 border-t border-dark-border pt-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-medium text-white">{payment.plan} · {formatPrice(payment.amount)}</p>
                      <p className="text-xs text-light-gray">{payment.purchaseType} · {payment.status} · {formatDate(payment.createdAt)}</p>
                    </div>
                    <button
                      onClick={() => reconcilePendingPayment(payment)}
                      disabled={busyPlan === 'reconcile'}
                      className="rounded-lg border border-white/60 px-4 py-2 text-sm text-white hover:bg-white hover:text-black disabled:opacity-40"
                    >
                      {busyPlan === 'reconcile' ? 'Checking…' : 'Check payment status'}
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {loading ? (
            <div className="py-20 text-center text-light-gray">Loading membership plans…</div>
          ) : plans.length === 0 ? (
            <div className="py-20 text-center text-light-gray">No membership plans are currently available. Run the Phase 9–10 database migration and refresh this page.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
              {plans.map((plan, index) => {
                const Icon = icons[plan.code] || Star;
                const recommended = plan.code === 'premium';
                const canRenew = current && current.code === plan.code && current.daysLeft <= 30;
                const isCurrentPlan = current?.code === plan.code;
                const disabled = Boolean(busyPlan) || pendingPayments.length > 0 || Boolean(queued) || (current && !canRenew);
                return (
                  <motion.article
                    key={plan.planId}
                    initial={{ opacity: 0, y: 25 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.12 }}
                    className={'relative flex flex-col rounded-2xl bg-dark-secondary p-8 ' +
                      (recommended ? 'border-2 border-white' : 'border border-dark-border')}
                  >
                    {recommended && <span className="absolute right-0 top-0 bg-white px-4 py-1 text-xs font-bold text-black">MOST LOVED</span>}
                    <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-white/10">
                      <Icon className="h-7 w-7 text-white" />
                    </div>
                    <h2 className="text-2xl font-bold text-white">{plan.name}</h2>
                    <p className="mt-2 text-sm text-light-gray">{plan.durationDays} days of member benefits</p>
                    <p className="mt-6 text-4xl font-bold text-white">{formatPrice(plan.price)}</p>
                    <p className="mt-1 text-sm text-light-gray">{plan.discountPercent}% off eligible product purchases</p>
                    <ul className="my-8 flex-1 space-y-3">
                      {(plan.features || []).map((feature, featureIndex) => (
                        <li key={featureIndex} className="flex items-start gap-3 text-sm text-light-gray">
                          <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-400" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                    <button
                      onClick={() => startPurchase(plan)}
                      disabled={authLoading || Boolean(busyPlan) || Boolean(disabled)}
                      className={'w-full rounded-lg py-4 font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-40 ' +
                        (recommended ? 'bg-white text-black hover:bg-lighter-gray' : 'border border-white text-white hover:bg-white hover:text-black')}
                    >
                      {busyPlan === plan.code ? 'Opening secure checkout…' :
                        pendingPayments.length > 0 ? 'Resolve payment above' :
                          queued ? 'Renewal already queued' :
                            isCurrentPlan && !canRenew ? 'Already active' :
                              isCurrentPlan && canRenew ? 'Renew membership' : 'Subscribe securely'}
                    </button>
                  </motion.article>
                );
              })}
            </div>
          )}

          <section className="rounded-2xl border border-dark-border bg-dark-secondary p-6 md:p-8">
            <div className="mb-6 flex items-center gap-3">
              <CalendarDays className="h-5 w-5 text-light-gray" />
              <h2 className="text-2xl font-semibold text-white">Membership history</h2>
            </div>
            {!isLoggedIn ? (
              <p className="text-sm text-light-gray">Sign in to view membership history and manage renewals.</p>
            ) : !summary?.history?.length ? (
              <p className="text-sm text-light-gray">No membership purchases yet.</p>
            ) : (
              <div className="space-y-3">
                {summary.history.map((item) => (
                  <div key={item.membershipId} className="flex flex-col gap-2 border-b border-dark-border pb-3 last:border-0 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-medium text-white">{item.name}</p>
                      <p className="text-xs text-light-gray">{formatDate(item.startsAt)} – {formatDate(item.expiresAt)}</p>
                    </div>
                    <span className="text-xs uppercase tracking-wider text-light-gray">{item.status}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-6 flex items-center gap-2 text-xs text-light-gray">
              <RefreshCw className="h-4 w-4" />
              Membership does not auto-renew. Renew during the final 30 days to queue the next term.
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
