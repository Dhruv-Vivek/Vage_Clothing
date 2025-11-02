import Navbar from '../components/Navbar';
import HeroSection from '../components/HeroSection';
import ProductShowcase from '../components/ProductShowcase';
import FeaturesSection from '../components/FeaturesSection';
import Footer from '../components/Footer';
import { premiumCollection } from '../data/products';

function Home() {
  return (
    <div className="min-h-screen bg-dark">
      <Navbar />
      <HeroSection />
      
      {/* Premium Collection Section Header */}
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

      {/* Premium Product Showcases */}
      {premiumCollection.map((product, index) => (
        <ProductShowcase 
          key={product.id} 
          product={product} 
          reverse={index % 2 !== 0} 
        />
      ))}
      
      {/* Features Section */}
      <FeaturesSection />
      
      {/* Footer */}
      <Footer />
    </div>
  );
}

export default Home;