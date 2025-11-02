import { motion } from 'framer-motion';
import { Sparkles, Leaf, Clock } from 'lucide-react';
import { BackgroundBeams } from './ui/background-beams';

const iconMap = {
  quality: Sparkles,
  sustainable: Leaf,
  design: Clock
};

function FeatureCard({ feature, index }) {
  const Icon = iconMap[feature.icon];

  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, delay: index * 0.2 }}
      className="group relative"
    >
      <div className="relative h-full p-8 bg-dark-secondary border border-dark-border rounded-xl hover:border-lighter-gray transition-all duration-300">
        {/* Icon */}
        <motion.div
          whileHover={{ scale: 1.1, rotate: 5 }}
          transition={{ type: "spring", stiffness: 400 }}
          className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center mb-6 group-hover:bg-white/20 transition-colors"
        >
          <Icon className="w-8 h-8 text-white" />
        </motion.div>

        {/* Content */}
        <h3 className="text-2xl font-bold text-white mb-3">
          {feature.title}
        </h3>
        <p className="text-light-gray">
          {feature.description}
        </p>

        {/* Hover Effect */}
        <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent rounded-xl"></div>
        </div>
      </div>
    </motion.div>
  );
}

function FeaturesSection() {
  const features = [
    {
      title: "Premium Quality",
      description: "Crafted with the finest materials",
      icon: "quality"
    },
    {
      title: "Sustainable",
      description: "Eco-friendly production process",
      icon: "sustainable"
    },
    {
      title: "Timeless Design",
      description: "Classic styles that never fade",
      icon: "design"
    }
  ];

  return (
    <section className="relative py-32 px-4 sm:px-6 lg:px-8 overflow-hidden">
      {/* Background Beams */}
      <BackgroundBeams className="opacity-50" />

      <div className="relative z-10 max-w-7xl mx-auto">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-4">
            Why Choose VAGE
          </h2>
          <p className="text-light-gray text-lg max-w-2xl mx-auto">
            Excellence in every detail, sustainability in every stitch
          </p>
        </motion.div>

        {/* Feature Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <FeatureCard key={feature.title} feature={feature} index={index} />
          ))}
        </div>

        {/* CTA Button */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="text-center mt-16"
        >
          <button 
            onClick={() => window.location.href = '/products'}
            className="group px-8 py-4 bg-white text-black rounded-lg hover:bg-lighter-gray transition-all duration-300 inline-flex items-center gap-2"
          >
            <span className="font-medium">Explore All Products</span>
            <motion.span
              animate={{ x: [0, 5, 0] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              →
            </motion.span>
          </button>
        </motion.div>
      </div>
    </section>
  );
}

export default FeaturesSection;