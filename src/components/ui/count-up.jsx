'use client';

import { useEffect, useRef } from "react";
import { animate, motion, useInView, useMotionValue, useTransform } from "framer-motion";

// Number that counts up the first time it scrolls into view.
export const CountUp = ({ to, from = 0, duration = 2.2, prefix = "", suffix = "", className }) => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  const value = useMotionValue(from);
  const display = useTransform(value, (v) => Math.round(v).toLocaleString("en-IN"));

  useEffect(() => {
    if (!inView) return undefined;
    const controls = animate(value, to, { duration, ease: [0.22, 1, 0.36, 1] });
    return () => controls.stop();
  }, [inView, to, duration, value]);

  return (
    <span ref={ref} className={className}>
      {prefix}
      <motion.span>{display}</motion.span>
      {suffix}
    </span>
  );
};
