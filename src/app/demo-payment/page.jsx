'use client';

import { useCallback, useEffect, useState, Suspense } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft, ShieldCheck, Smartphone, CreditCard, Landmark, Wallet,
  LockKeyhole, Clock3, CheckCircle2, AlertCircle, RefreshCw, ChevronRight,
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCart } from '@/context/CartContext';

const PAYMENT_METHODS = [
  { id: 'UPI', name: 'UPI', description: 'Google Pay, PhonePe, BHIM', Icon: Smartphone },
  { id: 'CARD', name: 'Credit / Debit Card', description: 'Visa, Mastercard and RuPay', Icon: CreditCard },
  { id: 'NETBANKING', name: 'Net Banking', description: 'Select your bank', Icon: Landmark },
  { id: 'WALLET', name: 'Wallet', description: 'Digital wallet simulation', Icon: Wallet },
];

const OUTCOMES = [
  { value: 'SUCCESS', label: 'Successful payment' },
  { value: 'FAILED', label: 'Failed payment' },
  { value: 'PENDING', label: 'Pending payment' },
  { value: 'USER_DROPPED', label: 'Customer abandoned checkout' },
];

function formatPrice(value) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function DemoPaymentContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderId = searchParams.get('orderId');
  const { clearCart } = useCart();

  const [orderData, setOrderData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedMethod, setSelectedMethod] = useState('UPI');
  const [otpSession, setOtpSession] = useState(null);
  const [otp, setOtp] = useState('');
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [outcome, setOutcome] = useState('SUCCESS');
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [notice, setNotice] = useState('');

  const loadOrder = useCallback(async () => {
    if (!orderId || !/^\d+$/.test(orderId)) {
      setErrorMessage('A valid VAGE order reference was not provided.');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`/api/orders/${encodeURIComponent(orderId)}`, {
        cache: 'no-store',
        credentials: 'same-origin',
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'Unable to load your order.');

      if (body.order?.payment_provider !== 'DEMO') {
        throw new Error('This order is not assigned to the local demo payment gateway.');
      }
      setOrderData(body);

      if (body.order.payment_status !== 'PENDING') {
        router.replace(`/order-success?orderId=${orderId}&provider=DEMO`);
      }
    } catch (error) {
      setErrorMessage(error.message || 'Unable to load your order.');
    } finally {
      setLoading(false);
    }
  }, [orderId, router]);

  useEffect(() => {
    loadOrder();
  }, [loadOrder]);

  useEffect(() => {
    if (!otpSession || remainingSeconds <= 0) return undefined;
    const timer = window.setInterval(() => {
      setRemainingSeconds((value) => Math.max(0, value - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [otpSession, remainingSeconds]);

  const cancelCheckout = async () => {
    if (!orderId || busy) return;
    setBusy(true);
    setErrorMessage('');
    try {
      const response = await fetch('/api/payments/demo/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        cache: 'no-store',
        body: JSON.stringify({ orderId: Number(orderId) }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'Unable to cancel this demo checkout.');
      router.replace('/cart');
    } catch (error) {
      setErrorMessage(error.message || 'Unable to cancel this demo checkout.');
    } finally {
      setBusy(false);
    }
  };

  const requestOtp = async () => {
    if (!orderId || busy) return;
    setBusy(true);
    setErrorMessage('');
    setNotice('');

    try {
      const response = await fetch('/api/payments/demo/otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        cache: 'no-store',
        body: JSON.stringify({ orderId: Number(orderId), paymentMethod: selectedMethod }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'Unable to start payment verification.');

      setOtpSession({
        sessionToken: body.sessionToken,
        demoOtp: body.demoOtp,
        paymentMethod: body.paymentMethod,
      });
      setOtp('');
      setRemainingSeconds(Number(body.expiresIn) || 300);
      setNotice('A demo OTP session is ready. No real email or SMS was sent.');
    } catch (error) {
      setErrorMessage(error.message || 'Unable to start payment verification.');
    } finally {
      setBusy(false);
    }
  };

  const completePayment = async (event) => {
    event.preventDefault();
    if (!otpSession || busy) return;
    if (!/^[0-9]{6}$/.test(otp)) {
      setErrorMessage('Enter the six-digit demo OTP.');
      return;
    }
    if (remainingSeconds <= 0) {
      setErrorMessage('The demo OTP has expired. Request a new one.');
      return;
    }

    setBusy(true);
    setErrorMessage('');
    setNotice('Verifying your demo OTP and processing the selected outcome…');

    try {
      const response = await fetch('/api/payments/demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        cache: 'no-store',
        body: JSON.stringify({
          orderId: Number(orderId),
          sessionToken: otpSession.sessionToken,
          otp,
          paymentMethod: otpSession.paymentMethod,
          outcome,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok && response.status !== 202) {
        throw new Error(body.error || 'Unable to process demo payment.');
      }

      if (body.paymentStatus === 'PAID' || body.paymentStatus === 'PENDING') {
        clearCart();
      }
      router.replace(`/order-success?orderId=${orderId}&provider=DEMO`);
    } catch (error) {
      setNotice('');
      setErrorMessage(error.message || 'Unable to process demo payment.');
    } finally {
      setBusy(false);
    }
  };

  const order = orderData?.order;
  const selected = PAYMENT_METHODS.find((method) => method.id === selectedMethod) || PAYMENT_METHODS[0];
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = String(remainingSeconds % 60).padStart(2, '0');

  if (loading) {
    return (
      <div className="min-h-[65vh] bg-dark flex items-center justify-center text-light-gray">
        <RefreshCw className="w-5 h-5 mr-3 animate-spin" /> Preparing secure demo checkout…
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-[65vh] bg-dark px-4 pt-36 text-center">
        <AlertCircle className="w-10 h-10 text-red-300 mx-auto mb-4" />
        <h1 className="text-2xl text-white font-bold mb-3">Checkout unavailable</h1>
        <p className="text-light-gray mb-6">{errorMessage || 'Unable to retrieve this order.'}</p>
        <button onClick={() => router.push('/cart')} className="px-6 py-3 bg-white text-black rounded-lg">Return to cart</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark">
      <div className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <button
            type="button"
            onClick={cancelCheckout}
            disabled={busy}
            className="inline-flex items-center gap-2 text-light-gray hover:text-white mb-8 transition-colors disabled:opacity-50"
          >
            <ArrowLeft className="w-4 h-4" /> Cancel payment & return to cart
          </button>

          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-amber-300/40 bg-amber-300/10 text-amber-200 text-xs font-bold tracking-widest mb-5">
              DEMO MODE · NO REAL PAYMENT
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-3">VAGE PAY</h1>
            <p className="text-light-gray">A separate, simulated payment gateway for your VAGE demonstration.</p>
          </div>

          {errorMessage && (
            <div role="alert" className="mb-6 rounded-lg border border-red-500/40 bg-red-500/10 p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-300 flex-shrink-0" />
              <p className="text-red-100 text-sm">{errorMessage}</p>
            </div>
          )}
          {notice && (
            <div role="status" className="mb-6 rounded-lg border border-blue-400/30 bg-blue-400/10 p-4 text-blue-100 text-sm">
              {notice}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-7">
            <motion.section
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-dark-secondary border border-dark-border rounded-2xl p-6 sm:p-8"
            >
              {!otpSession ? (
                <>
                  <div className="flex items-center justify-between gap-3 mb-6">
                    <div>
                      <h2 className="text-xl font-bold text-white">Choose payment method</h2>
                      <p className="text-light-gray text-sm mt-1">Select how you would like to simulate payment.</p>
                    </div>
                    <ShieldCheck className="w-7 h-7 text-green-400" />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {PAYMENT_METHODS.map(({ id, name, description, Icon }) => (
                      <button
                        type="button"
                        key={id}
                        onClick={() => setSelectedMethod(id)}
                        className={`text-left p-5 rounded-xl border transition-all ${selectedMethod === id ? 'border-white bg-white/10' : 'border-dark-border bg-dark hover:border-light-gray'}`}
                      >
                        <div className="flex items-center justify-between mb-4">
                          <Icon className="w-6 h-6 text-white" />
                          <span className={`w-4 h-4 rounded-full border flex items-center justify-center ${selectedMethod === id ? 'border-white' : 'border-light-gray'}`}>
                            {selectedMethod === id && <span className="w-2 h-2 rounded-full bg-white" />}
                          </span>
                        </div>
                        <p className="text-white font-semibold">{name}</p>
                        <p className="text-light-gray text-xs mt-1">{description}</p>
                      </button>
                    ))}
                  </div>

                  <div className="mt-7 p-4 rounded-xl bg-dark border border-dark-border flex gap-3">
                    <LockKeyhole className="w-5 h-5 text-green-400 flex-shrink-0" />
                    <p className="text-light-gray text-sm">
                      This is a local simulator. Do not enter actual card, bank or UPI credentials. The selected method is recorded as a demo payment method.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={requestOtp}
                    disabled={busy}
                    className="w-full mt-7 py-4 bg-white text-black rounded-lg font-semibold hover:bg-lighter-gray transition-all disabled:opacity-50"
                  >
                    {busy ? 'Preparing verification…' : `Continue with ${selected.name}`}
                    {!busy && <ChevronRight className="inline-block w-5 h-5 ml-2 -mt-0.5" />}
                  </button>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-11 h-11 rounded-full bg-white/10 flex items-center justify-center">
                      <LockKeyhole className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-white">OTP Verification</h2>
                      <p className="text-light-gray text-sm">Confirm your simulated {selected.name} payment.</p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-amber-300/40 bg-amber-300/10 p-5 mb-6">
                    <p className="text-amber-100 text-sm font-semibold mb-2">Your demo OTP</p>
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-3xl sm:text-4xl font-mono tracking-[0.3em] text-white">{otpSession.demoOtp}</p>
                      <span className="inline-flex items-center gap-1 text-amber-100 text-xs">
                        <Clock3 className="w-4 h-4" /> {minutes}:{seconds}
                      </span>
                    </div>
                    <p className="text-amber-100/80 text-xs mt-3">
                      This fixed code is shown only for the local demo. It was not sent to your phone or email.
                    </p>
                  </div>

                  <form onSubmit={completePayment} className="space-y-5">
                    <div>
                      <label htmlFor="demo-otp" className="block text-sm font-medium text-white mb-2">Enter six-digit OTP</label>
                      <input
                        id="demo-otp"
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        maxLength={6}
                        pattern="[0-9]{6}"
                        value={otp}
                        onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="Enter 111000"
                        className="w-full px-4 py-4 bg-dark border border-dark-border rounded-lg text-white text-center text-2xl tracking-[0.4em] font-mono focus:outline-none focus:border-white"
                      />
                      <p className="text-light-gray text-xs mt-2">Five attempts are allowed. OTP expires in five minutes.</p>
                    </div>

                    <div>
                      <label htmlFor="demo-outcome" className="block text-sm font-medium text-white mb-2">Simulation result</label>
                      <select
                        id="demo-outcome"
                        value={outcome}
                        onChange={(event) => setOutcome(event.target.value)}
                        className="w-full px-4 py-3 bg-dark border border-dark-border rounded-lg text-white focus:outline-none focus:border-white"
                      >
                        {OUTCOMES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                      </select>
                      <p className="text-light-gray text-xs mt-2">Choose an outcome to demonstrate different payment states. No actual money moves.</p>
                    </div>

                    <button
                      type="submit"
                      disabled={busy || remainingSeconds <= 0 || otp.length !== 6}
                      className="w-full py-4 bg-white text-black rounded-lg font-semibold hover:bg-lighter-gray transition-all disabled:opacity-50"
                    >
                      {busy ? 'Verifying…' : `Verify OTP & Pay ${formatPrice(order.total_amount)}`}
                    </button>
                  </form>

                  <div className="flex flex-wrap items-center justify-between gap-3 mt-5">
                    <button
                      type="button"
                      onClick={() => {
                        setOtpSession(null);
                        setOtp('');
                        setNotice('');
                        setErrorMessage('');
                      }}
                      disabled={busy}
                      className="text-sm text-light-gray hover:text-white underline"
                    >
                      Change payment method
                    </button>
                    <button
                      type="button"
                      onClick={requestOtp}
                      disabled={busy}
                      className="text-sm text-white underline disabled:opacity-50"
                    >
                      Resend demo OTP
                    </button>
                  </div>
                </>
              )}
            </motion.section>

            <aside className="h-fit bg-dark-secondary border border-dark-border rounded-2xl p-6">
              <h2 className="text-lg font-bold text-white mb-5">Order Summary</h2>
              <div className="text-xs uppercase tracking-wider text-light-gray mb-1">Order number</div>
              <p className="text-white font-mono text-sm mb-5">{order.order_number}</p>

              <div className="flex justify-between gap-3 text-light-gray text-sm mb-3">
                <span>Subtotal</span><span>{formatPrice(order.subtotal)}</span>
              </div>
              <div className="flex justify-between gap-3 text-light-gray text-sm mb-3">
                <span>Discounts</span><span>− {formatPrice(order.discount_amount)}</span>
              </div>
              <div className="flex justify-between gap-3 text-light-gray text-sm mb-5">
                <span>Delivery</span><span>{formatPrice(order.shipping_amount)}</span>
              </div>
              <div className="border-t border-dark-border pt-4 flex justify-between gap-3 text-white font-bold text-xl">
                <span>Total</span><span>{formatPrice(order.total_amount)}</span>
              </div>

              <div className="mt-6 rounded-lg border border-green-500/20 bg-green-500/5 p-4">
                <div className="flex items-center gap-2 text-green-300 text-sm font-semibold mb-2">
                  <CheckCircle2 className="w-4 h-4" /> Secure demo session
                </div>
                <p className="text-light-gray text-xs">
                  Payment state is processed by VAGE's server and saved to MySQL. No real transaction is performed.
                </p>
              </div>
            </aside>
          </div>

          <p className="text-center text-light-gray text-xs mt-8">
            VAGE Demo Gateway · Automated order email notifications will be added in a later phase.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function DemoPaymentPage() {
  return (
    <Suspense fallback={<div className="min-h-[65vh] bg-dark" />}>
      <DemoPaymentContent />
    </Suspense>
  );
}
