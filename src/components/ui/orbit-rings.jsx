'use client';

import { motion } from "framer-motion";
import { cn } from "../../lib/utils";

// Slowly turning dashed rings used as a hero backdrop.
export const OrbitRings = ({ className }) => {
  return (
    <div
      className={cn("pointer-events-none absolute inset-0 flex items-center justify-center", className)}
      aria-hidden="true"
    >
      <motion.div
        className="absolute h-[22rem] w-[22rem] rounded-full border border-white/10"
        animate={{ scale: [1, 1.06, 1], opacity: [0.4, 0.9, 0.4] }}
        transition={{ duration: 6, ease: "easeInOut", repeat: Infinity }}
      />
      <motion.div
        className="absolute h-[34rem] w-[34rem] rounded-full border border-dashed border-white/10"
        animate={{ rotate: 360 }}
        transition={{ duration: 80, ease: "linear", repeat: Infinity }}
      />
      <motion.div
        className="absolute h-[48rem] w-[48rem] rounded-full border border-dashed border-white/[0.06]"
        animate={{ rotate: -360 }}
        transition={{ duration: 120, ease: "linear", repeat: Infinity }}
      />
    </div>
  );
};
