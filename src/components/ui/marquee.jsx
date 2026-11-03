'use client';

import { motion } from "framer-motion";
import { cn } from "../../lib/utils";

// Endless horizontal ticker. Four copies allow the animation to loop seamlessly.
export const Marquee = ({ items, reverse = false, duration = 40, separator = "✦", className }) => {
  const group = (key) => (
    <div key={key} className="flex shrink-0 items-center gap-8 pr-8">
      {items.map((item, i) => (
        <span key={`${key}-${i}`} className="flex items-center gap-8 whitespace-nowrap">
          {item}
          <span className="text-white/20">{separator}</span>
        </span>
      ))}
    </div>
  );

  return (
    <div className={cn("flex select-none overflow-hidden", className)} aria-hidden="true">
      <motion.div
        className="flex w-max"
        animate={{ x: reverse ? ["-25%", "0%"] : ["0%", "-25%"] }}
        transition={{ duration, ease: "linear", repeat: Infinity }}
      >
        {[0, 1, 2, 3].map((k) => group(k))}
      </motion.div>
    </div>
  );
};
