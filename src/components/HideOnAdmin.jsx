'use client';

import { usePathname } from 'next/navigation';

// Storefront chrome (navbar/footer) is hidden inside /admin, which has its own layout.
export default function HideOnAdmin({ children }) {
  const pathname = usePathname();
  if (pathname?.startsWith('/admin')) return null;
  return children;
}
