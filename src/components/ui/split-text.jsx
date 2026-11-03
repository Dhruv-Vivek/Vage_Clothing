'use client';

import { motion } from "framer-motion";
import { cn } from "../../lib/utils";

// Headline where every letter rises out of a mask, one after another.
export const SplitText = ({ text, className, delay = 0, stagger = 0.045, as = "h1" }) => {
  const Tag = as;
  let letterIndex = 0;

  return (
    <Tag aria-label={text} className={cn("flex flex-wrap justify-center", className)}>
      {text.split(" ").map((word, wordIndex) => (
        <span
          key={`${word}-${wordIndex}`}
          aria-hidden="true"
          className="mr-[0.28em] inline-block overflow-hidden whitespace-nowrap pb-[0.12em] last:mr-0"
        >
          {[...word].map((char) => {
            const i = letterIndex++;
            return (
              <motion.span
                key={i}
                className="inline-block"
                initial={{ y: "115%", rotate: 10, opacity: 0 }}
                animate={{ y: "0%", rotate: 0, opacity: 1 }}
                transition={{ duration: 0.9, delay: delay + i * stagger, ease: [0.22, 1, 0.36, 1] }}
              >
                {char}
              </motion.span>
            );
          })}
        </span>
      ))}
    </Tag>
  );
};
