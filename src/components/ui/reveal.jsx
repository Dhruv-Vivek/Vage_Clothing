'use client';

import { motion } from "framer-motion";

// Scroll reveal: fades and moves into place the first time it enters the viewport.
export const Reveal = ({
  children,
  className,
  delay = 0,
  y = 40,
  x = 0,
  blur = true,
  as = "div",
}) => {
  const Component = motion[as] || motion.div;

  return (
    <Component
      initial={{ opacity: 0, y, x, filter: blur ? "blur(12px)" : "blur(0px)" }}
      whileInView={{ opacity: 1, y: 0, x: 0, filter: "blur(0px)" }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.9, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </Component>
  );
};
