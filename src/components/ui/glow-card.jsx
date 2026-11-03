'use client';

import { motion, useMotionTemplate, useMotionValue } from "framer-motion";
import { cn } from "../../lib/utils";

// Dark card with a soft light that follows the cursor.
export const GlowCard = ({ children, className }) => {
  const mouseX = useMotionValue(-300);
  const mouseY = useMotionValue(-300);

  const handleMouseMove = ({ currentTarget, clientX, clientY }) => {
    const { left, top } = currentTarget.getBoundingClientRect();
    mouseX.set(clientX - left);
    mouseY.set(clientY - top);
  };

  const glow = useMotionTemplate`radial-gradient(280px circle at ${mouseX}px ${mouseY}px, rgba(255,255,255,0.13), transparent 70%)`;

  return (
    <div
      onMouseMove={handleMouseMove}
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-dark-border bg-dark-secondary",
        className
      )}
    >
      <motion.div
        className="pointer-events-none absolute -inset-px rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: glow }}
      />
      <div className="relative">{children}</div>
    </div>
  );
};
