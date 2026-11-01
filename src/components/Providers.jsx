'use client';

import { MotionConfig } from 'framer-motion';
import { AuthProvider } from '../context/AuthContext';
import { CartProvider } from '../context/CartContext';

// The one place all client-side providers are composed (same nesting as the old main.jsx:
// Auth > Cart). MotionConfig makes every Framer Motion animation respect the visitor's
// "reduce motion" operating-system setting.
export default function Providers({ children }) {
  return (
    <MotionConfig reducedMotion="user">
      <AuthProvider>
        <CartProvider>{children}</CartProvider>
      </AuthProvider>
    </MotionConfig>
  );
}
