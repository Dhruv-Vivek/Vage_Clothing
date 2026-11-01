'use client';

import { useEffect, useState } from 'react';
import HeroSection from '@/components/HeroSection';
import ProductShowcase from '@/components/ProductShowcase';
import FeaturesSection from '@/components/FeaturesSection';

function Home() {
  const [featuredProducts, setFeaturedProducts] = useState([]);
  const [catalogueError, setCatalogueError] = useState('');

  useEffect(() => {
    const controller = new AbortController();

    async function loadFeaturedProducts() {
      try {
        const response = await fetch('/api/products?limit=48&sort=newest', {
          cache: 'no-store',
          signal: controller.signal,
        });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || 'Unable to load the featured collection.');

        // These are the two premium showcase products already present in the Vage catalogue.
        const featuredSlugs = ['classical-premium-tee', 'premium-hoodie'];
        const productsBySlug = new Map((body.products || []).map((product) => [product.slug, product]));
        setFeaturedProducts(featuredSlugs.map((slug) => productsBySlug.get(slug)).filter(Boolean));
      } catch (error) {
        if (error.name !== 'AbortError') setCatalogueError(error.message);
      }
    }

    loadFeaturedProducts();
    return () => controller.abort();
  }, []);

  return (
    <div className="bg-dark">
      <HeroSection />

      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-4 tracking-tight" style={{ fontFamily: 'serif' }}>
            𝔒𝔲𝔯  ℭ𝔬𝔩𝔩𝔢𝔠𝔱𝔦𝔬𝔫
          </h2>
          <p className="text-lg text-light-gray max-w-2xl mx-auto">
            Each piece is meticulously crafted to represent the pinnacle of modern fashion
          </p>
        </div>
      </section>

      {featuredProducts.map((product, index) => (
        <ProductShowcase key={product.id} product={product} reverse={index % 2 !== 0} />
      ))}

      {catalogueError && (
        <p className="max-w-7xl mx-auto px-4 pb-8 text-center text-sm text-red-300" role="status">
          The featured collection could not be loaded. {catalogueError}
        </p>
      )}

      <FeaturesSection />
    </div>
  );
}

export default Home;
