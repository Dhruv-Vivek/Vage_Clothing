'use client';

import { useState } from 'react';
import { AnimatePresence, motion, useAnimation } from 'framer-motion';
import { Mail, Phone, MapPin, Clock, Plus, Loader2 } from 'lucide-react';
import { Spotlight } from './ui/spotlight';
import { BackgroundBeams } from './ui/background-beams';
import { MovingBorderButton } from './ui/moving-border';
import { Reveal } from './ui/reveal';
import { SplitText } from './ui/split-text';
import { GlowCard } from './ui/glow-card';
import { OrbitRings } from './ui/orbit-rings';
import { FloatingField } from './ui/floating-field';
import { cn } from '../lib/utils';
import { deliveryOptions, membershipPlans } from '../data/products';

/* -------------------------------------------------------------------------- */
/*  TODO: replace these placeholder details with the real ones.               */
/* -------------------------------------------------------------------------- */
const CONTACT_INFO = [
  { icon: Mail, label: 'Email', value: 'hello@vage.example', href: 'mailto:hello@vage.example' },
  { icon: Phone, label: 'Phone', value: '+91 00000 00000', href: 'tel:+910000000000' },
  { icon: MapPin, label: 'Studio', value: 'Your studio address, City, State' },
  { icon: Clock, label: 'Hours', value: 'Mon to Sat, 10:00 to 18:00' },
];

const TOPICS = ['Order help', 'Returns', 'Membership', 'Product question', 'Other'];
const MESSAGE_MAX = 500;

// FAQ answers are built from the same data the shop uses, so they always match it.
const shippingLine = (plan) => plan.features.find((f) => /shipping/i.test(f));
const FAQ = [
  {
    q: 'How long does delivery take?',
    a: deliveryOptions.map((d) => `${d.name}: ${d.days} (₹${d.price})`).join('  ·  '),
  },
  {
    q: 'Do members get free delivery?',
    a: membershipPlans.map((p) => `${p.name}: ${shippingLine(p)}`).join('. ') + '.',
  },
  {
    q: 'What discount does membership give?',
    a: `${membershipPlans.map((p) => `${p.name} ${p.discount}%`).join(', ')} off all products. See the Membership page for the full plans.`,
  },
  {
    q: 'I need help with an order.',
    a: 'Use the form above, choose "Order help" and include your order number so we can find it quickly.',
  },
  {
    q: 'How do I start a return?',
    a: 'Choose "Returns" in the form above and tell us the order number and the item. We will guide you from there.',
  },
];

/* -------------------------------------------------------------------------- */

// BATCH 1: demo only. Replace the body with a POST to an API route (for example storing the
// message in a MongoDB "contact_messages" collection) in a later batch.
async function sendMessage() {
  await new Promise((resolve) => setTimeout(resolve, 1200));
  return { ok: true };
}

function validate(form) {
  const errors = {};
  if (form.name.trim().length < 2) errors.name = 'Please enter your name.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim())) errors.email = 'Please enter a valid email address.';
  if (form.message.trim().length < 10) errors.message = 'Tell us a little more (at least 10 characters).';
  return errors;
}

function Hero() {
  return (
    <section className="relative flex h-[75vh] min-h-[560px] w-full items-center justify-center overflow-hidden bg-dark">
      <BackgroundBeams />
      <OrbitRings />
      <Spotlight className="-top-40 left-0 md:left-60 md:-top-20" fill="#ffffff" />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-dark" />

      <div className="relative z-10 px-4 text-center">
        <motion.p
          initial={{ opacity: 0, letterSpacing: '0.1em' }}
          animate={{ opacity: 1, letterSpacing: '0.5em' }}
          transition={{ duration: 1.6, delay: 0.2 }}
          className="mb-6 text-xs text-light-gray md:text-sm"
        >
          CONTACT
        </motion.p>
        <SplitText
          text="GET IN TOUCH"
          delay={0.5}
          className="text-5xl font-bold tracking-wider text-white md:text-7xl lg:text-8xl"
        />
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 1.5 }}
          className="mx-auto mt-8 max-w-xl text-lg leading-relaxed text-lighter-gray md:text-xl"
        >
          Questions about an order, a fit or a membership? Send us a message.
        </motion.p>
      </div>
    </section>
  );
}

function InfoPanel() {
  return (
    <div className="space-y-4">
      <Reveal>
        <h2 className="mb-2 text-3xl font-bold text-white md:text-4xl" style={{ fontFamily: 'serif' }}>
          Talk to us
        </h2>
        <p className="text-light-gray">Pick whichever way suits you. The form on the right is the quickest.</p>
      </Reveal>

      {CONTACT_INFO.map((item, i) => {
        const Icon = item.icon;
        const body = (
          <GlowCard className="p-5">
            <div className="flex items-center gap-4">
              <motion.div
                whileHover={{ scale: 1.15, rotate: 8 }}
                transition={{ type: 'spring', stiffness: 400 }}
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/10"
              >
                <Icon className="h-5 w-5 text-white" />
              </motion.div>
              <div className="min-w-0">
                <p className="text-xs tracking-[0.25em] text-light-gray">{item.label.toUpperCase()}</p>
                <p className="truncate text-white">{item.value}</p>
              </div>
            </div>
          </GlowCard>
        );
        return (
          <Reveal key={item.label} delay={0.1 + i * 0.1} x={-40} y={0}>
            {item.href ? <a href={item.href} className="block">{body}</a> : body}
          </Reveal>
        );
      })}
    </div>
  );
}

// Animated confirmation: ring + tick draw themselves, dots burst outwards.
function SentView({ name, onReset }) {
  const dots = Array.from({ length: 16 }, (_, i) => {
    const angle = (i * 360) / 16;
    const distance = 70 + (i % 3) * 20;
    return {
      x: Math.cos((angle * Math.PI) / 180) * distance,
      y: Math.sin((angle * Math.PI) / 180) * distance,
    };
  });

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex min-h-[420px] flex-col items-center justify-center p-8 text-center"
    >
      <div className="relative mb-8 flex h-28 w-28 items-center justify-center">
        {dots.map((d, i) => (
          <motion.span
            key={i}
            className="absolute h-1.5 w-1.5 rounded-full bg-white"
            initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
            animate={{ x: d.x, y: d.y, opacity: 0, scale: 0.3 }}
            transition={{ duration: 1, delay: 0.5, ease: 'easeOut' }}
          />
        ))}
        <svg viewBox="0 0 100 100" className="h-28 w-28" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <motion.circle cx="50" cy="50" r="44" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.8 }} />
          <motion.path d="M30 52 L45 66 L71 36" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.5, delay: 0.6 }} />
        </svg>
      </div>
      <motion.h3 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9 }} className="mb-2 text-3xl font-bold text-white">
        Thank you{name ? `, ${name.trim().split(' ')[0]}` : ''}.
      </motion.h3>
      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.1 }} className="max-w-sm text-light-gray">
        Your message has been noted.
      </motion.p>
      {/* TODO: remove this line once messages are saved by the backend */}
      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.3 }} className="mt-2 max-w-sm text-xs text-light-gray/60">
        Demo mode: messages are not stored until the backend is connected.
      </motion.p>
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5 }}
        onClick={onReset}
        className="mt-8 rounded-lg border border-dark-border px-6 py-2.5 text-sm text-white transition-colors hover:border-white"
      >
        Send another message
      </motion.button>
    </motion.div>
  );
}

function ContactForm() {
  const empty = { name: '', email: '', topic: TOPICS[0], orderNo: '', message: '' };
  const [form, setForm] = useState(empty);
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState('idle'); // idle | sending | sent | error
  const shake = useAnimation();

  const set = (key) => (e) => {
    const value = e.target.value;
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  async function handleSubmit(e) {
    e.preventDefault();
    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      shake.start({ x: [0, -10, 10, -8, 8, -4, 0], transition: { duration: 0.45 } });
      return;
    }
    setStatus('sending');
    try {
      await sendMessage(form);
      setStatus('sent');
    } catch {
      setStatus('error');
    }
  }

  function reset() {
    setForm(empty);
    setErrors({});
    setStatus('idle');
  }

  return (
    <GlowCard className="rounded-2xl">
      <AnimatePresence mode="wait">
        {status === 'sent' ? (
          <SentView key="sent" name={form.name} onReset={reset} />
        ) : (
          <motion.form
            key="form"
            onSubmit={handleSubmit}
            noValidate
            animate={shake}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-5 p-6 md:p-8"
          >
            <div>
              <p className="mb-3 text-xs tracking-[0.25em] text-light-gray">WHAT IS IT ABOUT?</p>
              <div className="flex flex-wrap gap-2">
                {TOPICS.map((topic) => {
                  const active = form.topic === topic;
                  return (
                    <button
                      key={topic}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setForm((f) => ({ ...f, topic }))}
                      className="relative rounded-full border border-dark-border px-4 py-2 text-sm text-light-gray transition-colors hover:border-white/50"
                    >
                      {active && (
                        <motion.span
                          layoutId="topic-pill"
                          className="absolute inset-0 rounded-full bg-white"
                          transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                        />
                      )}
                      <span className={cn('relative z-10', active && 'font-medium text-black')}>{topic}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <FloatingField label="Your name" value={form.name} onChange={set('name')} error={errors.name} autoComplete="name" />
              <FloatingField label="Email" type="email" value={form.email} onChange={set('email')} error={errors.email} autoComplete="email" />
            </div>

            <AnimatePresence initial={false}>
              {(form.topic === 'Order help' || form.topic === 'Returns') && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <FloatingField label="Order number (optional)" value={form.orderNo} onChange={set('orderNo')} />
                </motion.div>
              )}
            </AnimatePresence>

            <FloatingField
              label="Your message"
              multiline
              maxLength={MESSAGE_MAX}
              value={form.message}
              onChange={set('message')}
              error={errors.message}
            />

            {status === 'error' && (
              <p role="alert" className="text-sm text-red-400">Something went wrong. Please try again.</p>
            )}

            <MovingBorderButton type="submit" disabled={status === 'sending'} className="w-full">
              {status === 'sending' ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Sending...
                </span>
              ) : (
                'Send message'
              )}
            </MovingBorderButton>
          </motion.form>
        )}
      </AnimatePresence>
    </GlowCard>
  );
}

function Faq() {
  const [open, setOpen] = useState(0);

  return (
    <section className="px-4 py-24 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <Reveal className="mb-12 text-center">
          <p className="mb-4 text-xs tracking-[0.4em] text-light-gray">GOOD TO KNOW</p>
          <h2 className="text-4xl font-bold text-white md:text-5xl" style={{ fontFamily: 'serif' }}>
            Quick answers
          </h2>
        </Reveal>

        <div className="space-y-3">
          {FAQ.map((item, i) => {
            const isOpen = open === i;
            return (
              <Reveal key={item.q} delay={i * 0.07} blur={false} y={24}>
                <div className={cn('rounded-xl border bg-dark-secondary transition-colors', isOpen ? 'border-white/40' : 'border-dark-border')}>
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => setOpen(isOpen ? -1 : i)}
                    className="flex w-full items-center justify-between gap-4 p-5 text-left"
                  >
                    <span className="font-medium text-white">{item.q}</span>
                    <motion.span animate={{ rotate: isOpen ? 45 : 0 }} transition={{ duration: 0.25 }} className="shrink-0">
                      <Plus className="h-5 w-5 text-white" />
                    </motion.span>
                  </button>
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                        className="overflow-hidden"
                      >
                        <p className="px-5 pb-5 leading-relaxed text-light-gray">{item.a}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default function ContactContent() {
  return (
    <div className="bg-dark">
      <Hero />
      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-5 lg:gap-14">
          <div className="lg:col-span-2">
            <InfoPanel />
          </div>
          <Reveal className="lg:col-span-3" y={50}>
            <ContactForm />
          </Reveal>
        </div>
      </section>
      <Faq />
    </div>
  );
}
