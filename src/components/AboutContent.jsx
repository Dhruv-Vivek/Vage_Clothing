'use client';

import { useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  motion,
  useInView,
  useMotionValue,
  useScroll,
  useSpring,
  useTransform,
} from 'framer-motion';
import { ChevronDown, Sparkles, Leaf, Clock, PencilRuler, Scissors, Package, Truck } from 'lucide-react';
import { Spotlight } from './ui/spotlight';
import { BackgroundBeams } from './ui/background-beams';
import { TextGenerateEffect } from './ui/text-generate-effect';
import { MovingBorderButton } from './ui/moving-border';
import { CardContainer, CardBody, CardItem } from './ui/card-3d';
import { Reveal } from './ui/reveal';
import { SplitText } from './ui/split-text';
import { Marquee } from './ui/marquee';
import { CountUp } from './ui/count-up';
import { GlowCard } from './ui/glow-card';
import { OrbitRings } from './ui/orbit-rings';
import { products, premiumCollection, categories, deliveryOptions, membershipPlans } from '../data/products';

/* -------------------------------------------------------------------------- */
/*  Copy lives here so it is easy to edit. Replace it with your own brand story. */
/* -------------------------------------------------------------------------- */
const TICKER_TOP = ['PREMIUM QUALITY', 'SUSTAINABLE', 'TIMELESS DESIGN', 'DARK ELEGANCE', 'CRAFTED TO LAST'];
const TICKER_BOTTOM = ['HOODIES', 'TEES', 'BOTTOMS', 'SHOES', 'OUTERWEAR'];

const STORY = [
  'VAGE started from a simple belief: clothing should feel as considered as it looks. Every piece begins as a silhouette in black and has to earn its place in the collection.',
  'We choose premium materials and honest construction, so a hoodie, a tee or a pair of boots keeps its shape long after the first wear.',
  'Our palette is dark, never dull. Texture, cut and detail carry the design, which is why a VAGE piece pairs with almost everything you already own.',
];

const PRINCIPLES = [
  { icon: Sparkles, title: 'Premium Quality', text: 'Crafted with the finest materials, finished by hand where it matters.' },
  { icon: Leaf, title: 'Sustainable', text: 'An eco-friendly production process, because style should not cost the earth.' },
  { icon: Clock, title: 'Timeless Design', text: 'Classic styles that never fade, made to outlast the season.' },
];

const standard = deliveryOptions.find((d) => d.id === 'standard');
const express = deliveryOptions.find((d) => d.id === 'express');
const priority = deliveryOptions.find((d) => d.id === 'priority');

const STEPS = [
  { icon: PencilRuler, title: 'Design', text: 'Every piece starts as a sketch and a fit test, always in our dark-first palette.' },
  { icon: Scissors, title: 'Craft', text: 'Fabric is cut and stitched with attention to the details you only notice up close.' },
  { icon: Package, title: 'Pack', text: 'Your order is packed with care so it reaches you looking the way it left us.' },
  {
    icon: Truck,
    title: 'Deliver',
    text: `Standard in ${standard.days}, Express in ${express.days}, or Priority in ${priority.days}. You choose.`,
  },
];

// Real numbers taken from the site's own data, so they never go out of date.
const STATS = [
  { value: products.length + premiumCollection.length, label: 'Pieces in the collection' },
  { value: categories.length - 1, label: 'Categories' },
  { value: deliveryOptions.length, label: 'Delivery speeds' },
  { value: Math.max(...membershipPlans.map((p) => p.discount)), suffix: '%', label: 'Top member discount' },
];

/* -------------------------------------------------------------------------- */

function Hero() {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  // Parallax: background grows, text drifts down slower than the page and fades out
  const bgScale = useTransform(scrollYProgress, [0, 1], [1, 1.25]);
  const textY = useTransform(scrollYProgress, [0, 1], ['0%', '35%']);
  const fade = useTransform(scrollYProgress, [0, 0.75], [1, 0]);

  // Soft light that trails the cursor
  const glowX = useMotionValue(-999);
  const glowY = useMotionValue(-999);
  const x = useSpring(glowX, { stiffness: 70, damping: 18 });
  const y = useSpring(glowY, { stiffness: 70, damping: 18 });

  const handleMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    glowX.set(e.clientX - rect.left - 200);
    glowY.set(e.clientY - rect.top - 200);
  };

  return (
    <section
      ref={ref}
      onMouseMove={handleMove}
      className="relative h-screen w-full overflow-hidden bg-dark"
    >
      <motion.div style={{ scale: bgScale }} className="absolute inset-0">
        <BackgroundBeams />
        <OrbitRings />
      </motion.div>
      <Spotlight className="-top-40 left-0 md:left-60 md:-top-20" fill="#ffffff" />
      <motion.div
        style={{ x, y }}
        className="pointer-events-none absolute left-0 top-0 h-[400px] w-[400px] rounded-full bg-white/[0.07] blur-3xl"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-dark" />

      <motion.div
        style={{ y: textY, opacity: fade }}
        className="relative z-10 flex h-full flex-col items-center justify-center px-4 text-center"
      >
        <motion.p
          initial={{ opacity: 0, letterSpacing: '0.1em' }}
          animate={{ opacity: 1, letterSpacing: '0.5em' }}
          transition={{ duration: 1.6, delay: 0.2 }}
          className="mb-6 text-xs text-light-gray md:text-sm"
        >
          OUR STORY
        </motion.p>
        <SplitText
          text="BORN IN THE DARK"
          delay={0.5}
          className="text-5xl font-bold tracking-wider text-white md:text-7xl lg:text-8xl"
        />
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 1.8 }}
          className="mx-auto mt-8 max-w-2xl text-lg leading-relaxed text-lighter-gray md:text-xl"
        >
          Clothing for people who would rather be remembered than noticed.
        </motion.p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2.6 }}
        className="absolute bottom-8 left-1/2 z-10 -translate-x-1/2"
      >
        <motion.div animate={{ y: [0, 10, 0] }} transition={{ duration: 1.8, repeat: Infinity }}>
          <ChevronDown className="h-8 w-8 text-light-gray" />
        </motion.div>
      </motion.div>
    </section>
  );
}

function Tickers() {
  return (
    <section className="relative overflow-hidden border-y border-dark-border py-8">
      <Marquee
        items={TICKER_TOP}
        duration={45}
        className="text-5xl font-bold tracking-wider text-transparent md:text-7xl [-webkit-text-stroke:1px_#4a4a4a]"
      />
      <Marquee
        items={TICKER_BOTTOM}
        reverse
        duration={55}
        className="mt-4 text-3xl font-bold tracking-widest text-dark-border md:text-5xl"
      />
    </section>
  );
}

function Story() {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 75%', 'end 60%'] });
  const scaleY = useSpring(scrollYProgress, { stiffness: 120, damping: 30 });

  return (
    <section ref={ref} className="px-4 py-28 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-12 md:grid-cols-[1fr_1.4fr] md:gap-20">
        <div className="md:sticky md:top-32 md:self-start">
          <Reveal>
            <p className="mb-4 text-xs tracking-[0.4em] text-light-gray">THE PHILOSOPHY</p>
          </Reveal>
          <Reveal delay={0.1}>
            <h2 className="text-4xl font-bold leading-tight text-white md:text-5xl lg:text-6xl" style={{ fontFamily: 'serif' }}>
              Made with intent, worn with <span className="text-light-gray">attitude.</span>
            </h2>
          </Reveal>
        </div>

        <div className="relative space-y-12 md:pl-12">
          {/* thread that draws itself as you scroll */}
          <div className="absolute left-0 top-0 hidden h-full w-px bg-dark-border md:block">
            <motion.div style={{ scaleY }} className="h-full w-full origin-top bg-white" />
          </div>
          {STORY.map((paragraph, i) => (
            <Reveal key={i} delay={0.05} x={40} y={20}>
              <p className="text-xl leading-relaxed text-lighter-gray md:text-2xl">{paragraph}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function Manifesto() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-120px' });

  return (
    <section ref={ref} className="relative overflow-hidden px-4 py-28 text-center">
      <BackgroundBeams className="opacity-60" />
      <div className="relative z-10 mx-auto min-h-[10rem] max-w-5xl">
        {/* mounted only once visible, so the word-by-word reveal is actually seen */}
        {inView && <TextGenerateEffect words="STYLE IS YOUR ARMOUR" />}
      </div>
    </section>
  );
}

function Stats() {
  return (
    <section className="px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-4 md:grid-cols-4">
        {STATS.map((stat, i) => (
          <Reveal key={stat.label} delay={i * 0.1} blur={false}>
            <GlowCard className="p-6 text-center md:p-8">
              <CountUp to={stat.value} suffix={stat.suffix} className="text-5xl font-bold text-white md:text-6xl" />
              <p className="mt-3 text-sm text-light-gray">{stat.label}</p>
            </GlowCard>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function Principles() {
  return (
    <section className="px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <Reveal className="mb-14 text-center">
          <h2 className="text-4xl font-bold text-white md:text-5xl" style={{ fontFamily: 'serif' }}>
            What we stand for
          </h2>
        </Reveal>
        <div className="grid gap-8 md:grid-cols-3">
          {PRINCIPLES.map((item, i) => {
            const Icon = item.icon;
            return (
              <Reveal key={item.title} delay={i * 0.15}>
                <CardContainer className="w-full">
                  <CardBody className="group/card relative h-auto w-full rounded-xl border border-dark-border bg-dark-secondary p-8">
                    <CardItem translateZ="60">
                      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-white/10">
                        <Icon className="h-8 w-8 text-white" />
                      </div>
                    </CardItem>
                    <CardItem translateZ="50" className="w-full">
                      <h3 className="mb-3 text-2xl font-bold text-white">{item.title}</h3>
                    </CardItem>
                    <CardItem translateZ="30" className="w-full">
                      <p className="text-light-gray">{item.text}</p>
                    </CardItem>
                  </CardBody>
                </CardContainer>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Process() {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 70%', 'end 70%'] });
  const scaleY = useSpring(scrollYProgress, { stiffness: 100, damping: 30 });

  return (
    <section className="px-4 py-24 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <Reveal className="mb-16 text-center">
          <p className="mb-4 text-xs tracking-[0.4em] text-light-gray">HOW IT COMES TOGETHER</p>
          <h2 className="text-4xl font-bold text-white md:text-5xl" style={{ fontFamily: 'serif' }}>
            From sketch to doorstep
          </h2>
        </Reveal>

        <div ref={ref} className="relative">
          <div className="absolute left-6 top-0 h-full w-px bg-dark-border md:left-1/2">
            <motion.div style={{ scaleY }} className="h-full w-full origin-top bg-white" />
          </div>

          <div className="space-y-16">
            {STEPS.map((step, i) => {
              const Icon = step.icon;
              const left = i % 2 === 0;
              return (
                <Reveal key={step.title} x={left ? -60 : 60} y={0} className="relative">
                  <div className={`flex items-start gap-6 pl-16 md:pl-0 ${left ? 'md:flex-row' : 'md:flex-row-reverse'}`}>
                    <div className={`md:w-1/2 ${left ? 'md:pr-16 md:text-right' : 'md:pl-16'}`}>
                      <p className="mb-1 text-xs tracking-[0.3em] text-light-gray">STEP 0{i + 1}</p>
                      <h3 className="mb-2 text-2xl font-bold text-white">{step.title}</h3>
                      <p className="text-light-gray">{step.text}</p>
                    </div>
                    <div className="md:w-1/2" />
                  </div>
                  <motion.div
                    whileHover={{ scale: 1.15, rotate: 8 }}
                    className="absolute left-0 top-0 flex h-12 w-12 items-center justify-center rounded-full border-2 border-white bg-dark md:left-1/2 md:-translate-x-1/2"
                  >
                    <Icon className="h-5 w-5 text-white" />
                  </motion.div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function CallToAction() {
  const router = useRouter();

  return (
    <section className="relative overflow-hidden px-4 py-32 text-center">
      <BackgroundBeams />
      <div className="relative z-10 mx-auto max-w-3xl">
        <Reveal>
          <h2 className="mb-6 text-4xl font-bold text-white md:text-6xl" style={{ fontFamily: 'serif' }}>
            Find your piece
          </h2>
        </Reveal>
        <Reveal delay={0.15}>
          <p className="mb-10 text-lg text-light-gray">
            The collection is waiting. Or tell us what you are looking for and we will point you to it.
          </p>
        </Reveal>
        <Reveal delay={0.3} className="flex flex-col items-center justify-center gap-4 sm:flex-row">
          <MovingBorderButton onClick={() => router.push('/products')} className="w-64">
            Explore the Collection
          </MovingBorderButton>
          <Link
            href="/contact"
            className="inline-flex h-12 w-64 items-center justify-center rounded-lg border border-dark-border text-sm font-medium text-white transition-colors hover:border-white"
          >
            Contact us
          </Link>
        </Reveal>
      </div>
    </section>
  );
}

export default function AboutContent() {
  return (
    <div className="bg-dark">
      <Hero />
      <Tickers />
      <Story />
      <Manifesto />
      <Stats />
      <Principles />
      <Process />
      <CallToAction />
    </div>
  );
}
