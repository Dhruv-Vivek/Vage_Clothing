'use client';

import { motion } from 'framer-motion';
import { ChevronDown, ArrowRight } from 'lucide-react';
import { TextGenerateEffect } from './ui/text-generate-effect';
import { MovingBorderButton } from './ui/moving-border';
import { Spotlight } from './ui/spotlight';
import { useRouter } from 'next/navigation';

function HeroSection() {
  const router = useRouter();

  return (
    <div className="relative h-screen w-full overflow-hidden">
      {/* Video Background */}
      <div className="absolute inset-0 w-full h-full">
        <video
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          className="w-full h-full object-cover"
        >
          <source src="/hero-video.mp4" type="video/mp4" />
          Your browser does not support the video tag.
        </video>
        
        {/* Dark Overlay */}
        <div className="absolute inset-0 bg-black/70"></div>
        
        {/* Subtle Grey Gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-dark/90"></div>
      </div>

      {/* Subtle Spotlight Effect */}
      <Spotlight
        className="-top-40 left-0 md:left-60 md:-top-20"
        fill="#ffffff"
      />

      {/* Content */}
      <div className="relative z-10 h-full flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="text-center max-w-5xl mx-auto"
        >
          {/* Main Heading */}
          <TextGenerateEffect
            words="DEFINE YOUR STYLE"
            className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-wider mb-8"
          />

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 1.5 }}
            className="text-lg md:text-xl lg:text-2xl text-lighter-gray mb-12 max-w-3xl mx-auto leading-relaxed"
          >
            Discover the perfect blend of contemporary design and timeless elegance
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 2 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-6"
          >
            {/* Shop Collection Button */}
            <MovingBorderButton
              onClick={() => router.push('/products')}
              className="group"
            >
              <span className="flex items-center gap-2">
                Shop Collection
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </span>
            </MovingBorderButton>

            {/* New Arrivals Button */}
            <button
              onClick={() => router.push('/products?filter=new')}
              className="px-8 py-3 rounded-lg border-2 border-white text-white hover:bg-white hover:text-black transition-all duration-300 font-medium"
            >
              New Arrivals
            </button>
          </motion.div>
        </motion.div>

        {/* Scroll Indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 2.5 }}
          className="absolute bottom-10 left-1/2 transform -translate-x-1/2"
        >
          <motion.div
            animate={{ y: [0, 10, 0] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="flex flex-col items-center cursor-pointer"
          >
            <span className="text-light-gray text-sm mb-2 tracking-wider">SCROLL</span>
            <ChevronDown className="w-6 h-6 text-lighter-gray" />
          </motion.div>
        </motion.div>
      </div>

      {/* Bottom fade to black */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-dark to-transparent z-[5]"></div>
    </div>
  );
}

export default HeroSection;