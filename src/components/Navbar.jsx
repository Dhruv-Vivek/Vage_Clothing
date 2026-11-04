'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  Search, 
  Heart, 
  ShoppingCart, 
  Menu, 
  X, 
  LogOut, 
  User 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import LoginModal from './LoginModal';

function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const { cartCount, favorites } = useCart();
  const { user, isLoggedIn, isLoading, logout, loginModalOpen, setLoginModalOpen } = useAuth();
  const router = useRouter();

  const handleSearch = (event) => {
    event.preventDefault();
    const query = searchTerm.trim();
    router.push(query ? `/products?q=${encodeURIComponent(query)}` : '/products');
  };

  useEffect(() => {
    const handleScroll = () => {
      // Set scrolled to true if the user scrolls down more than 50px
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { name: 'Home', path: '/' },
    { name: 'Products', path: '/products' },
    { name: 'Membership', path: '/membership' },
    { name: 'About Us', path: '/about' },
    { name: 'Contact', path: '/contact' },
  ];

  return (
    <motion.nav
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.5 }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-dark/80 backdrop-blur-lg border-b border-dark-border'
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <Link href="/" className="flex items-center">
            <span className="text-2xl font-bold tracking-wider text-white">
              VAGE
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            {navLinks.map((link) => (
              <Link
                key={link.name}
                href={link.path}
                className="text-light-gray hover:text-white transition-colors duration-300 relative group"
              >
                {link.name}
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-white transition-all duration-300 group-hover:w-full"></span>
              </Link>
            ))}
          </div>

          {/* Search Bar */}
          <form onSubmit={handleSearch} className="hidden lg:flex items-center">
            <div className="relative">
              <input
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="what are you looking for"
                aria-label="Search Vage products"
                className="bg-dark-secondary border border-dark-border rounded-lg pl-10 pr-12 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-lighter-gray transition-colors w-64"
              />
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 w-4 h-4" />
              <button type="submit" aria-label="Submit product search" className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white p-1">
                <span className="sr-only">Search</span>
                ↵
              </button>
            </div>
          </form>

          {/* Right Icons and Login/User Button Group */}
          <div className="flex items-center space-x-6">
            
            {/* Login/User Button - Corrected placement and logic */}
            {isLoading ? null : isLoggedIn ? (
              <div className="hidden md:flex items-center gap-4">
                <Link href="/orders" className="text-sm text-light-gray hover:text-white transition-colors">
                  My orders
                </Link>
                {user.role === 'ADMIN' && (
                  <Link
                    href="/admin"
                    className="px-4 py-2 bg-white text-black rounded-lg text-sm font-medium hover:bg-lighter-gray transition-colors"
                  >
                    Admin
                  </Link>
                )}
                <div className="flex items-center gap-2 text-white">
                  <User className="w-5 h-5" />
                  <span className="text-sm font-medium">{user.name}</span>
                </div>
                <button
                  onClick={() => {
                    logout();
                    router.push('/');
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-dark-secondary border border-dark-border text-white rounded-lg hover:border-white transition-all"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="text-sm">Logout</span>
                </button>
              </div>
            ) : (
              // Login Button (Desktop)
              <button
                onClick={() => setLoginModalOpen(true)}
                className="hidden md:flex items-center space-x-2 bg-white text-black px-6 py-2 rounded-lg hover:bg-lighter-gray transition-all duration-300"
              >
                <span className="text-sm font-medium">Login</span>
              </button>
            )}

            {/* Wishlist */}
            <button 
              onClick={() => router.push('/favorites')}
              className="relative group"
            >
              <Heart className="w-6 h-6 text-white group-hover:text-lighter-gray transition-colors" />
              {favorites.length > 0 && (
                <span className="absolute -top-2 -right-2 bg-white text-black text-xs rounded-full w-5 h-5 flex items-center justify-center font-medium">
                  {favorites.length}
                </span>
              )}
            </button>

            {/* Cart */}
            <button 
              onClick={() => router.push('/cart')}
              className="relative group"
            >
              <ShoppingCart className="w-6 h-6 text-white group-hover:text-lighter-gray transition-colors" />
              {cartCount > 0 && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -top-2 -right-2 bg-white text-black text-xs rounded-full w-5 h-5 flex items-center justify-center font-medium"
                >
                  {cartCount}
                </motion.span>
              )}
            </button>

            {/* Mobile Menu Button */}
            <button
              className="md:hidden text-white"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-dark/95 backdrop-blur-lg border-t border-dark-border"
          >
            <div className="px-4 py-6 space-y-4">
              {navLinks.map((link) => (
                <Link
                  key={link.name}
                  href={link.path}
                  className="block text-light-gray hover:text-white transition-colors py-2"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {link.name}
                </Link>
              ))}
              {/* Mobile Login Button */}
              {!isLoggedIn && (
                <button 
                  onClick={() => {
                    setMobileMenuOpen(false); 
                    setLoginModalOpen(true);
                  }}
                  className="w-full bg-white text-black px-6 py-3 rounded-lg hover:bg-lighter-gray transition-all"
                >
                  Login
                </button>
              )}
              {isLoggedIn && (
                <Link
                  href="/orders"
                  className="block text-light-gray hover:text-white transition-colors py-2"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  My orders
                </Link>
              )}
              {/* Mobile Logout Button */}
              {isLoggedIn && (
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    logout();
                    router.push('/');
                  }}
                  className="flex items-center justify-center w-full gap-2 px-4 py-3 bg-dark-secondary border border-dark-border text-white rounded-lg hover:border-white transition-all"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="text-sm font-medium">Logout</span>
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Login Modal */}
      <LoginModal isOpen={loginModalOpen} onClose={() => setLoginModalOpen(false)} />
    </motion.nav>
  );
}

export default Navbar;