'use client';

import { motion } from "framer-motion";
import { cn } from "../../lib/utils";

export const BackgroundBeams = ({ className }) => {
  const paths = [
    "M-380 -189C-380 -189 -312 216 152 343C616 470 684 875 684 875",
    "M-373 -197C-373 -197 -305 208 159 335C623 462 691 867 691 867",
    "M-366 -205C-366 -205 -298 200 166 327C630 454 698 859 698 859",
  ];

  return (
    <div
      className={cn(
        "absolute h-full w-full inset-0 [mask-image:radial-gradient(circle,white,transparent)]",
        className
      )}
    >
      <svg
        className="absolute h-full w-full pointer-events-none"
        width="100%"
        height="100%"
        viewBox="0 0 696 316"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {paths.map((path, index) => (
          <motion.path
            key={`path-${index}`}
            d={path}
            stroke={`url(#gradient-${index})`}
            strokeWidth="2"
            strokeLinecap="round"
            initial={{
              pathLength: 0,
            }}
            animate={{
              pathLength: 1,
            }}
            transition={{
              duration: 2,
              delay: index * 0.5,
              repeat: Infinity,
              repeatDelay: 3,
            }}
          />
        ))}
        <defs>
          {[0, 1, 2].map((index) => (
            <linearGradient
              key={`gradient-${index}`}
              id={`gradient-${index}`}
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#2a2a2a" stopOpacity="0" />
              <stop stopColor="#4a4a4a" />
              <stop offset="1" stopColor="#2a2a2a" stopOpacity="0" />
            </linearGradient>
          ))}
        </defs>
      </svg>
    </div>
  );
};