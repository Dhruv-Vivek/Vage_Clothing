'use client';

import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/context/AuthContext';

const CartContext = createContext(null);

function formatPrice(value) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function legacyPrice(value) {
  if (typeof value === 'number') return value;
  return Number(String(value || '0').replace(/[^0-9.]/g, '')) || 0;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within a CartProvider');
  return context;
}

export function CartProvider({ children }) {
  const [cartItems, setCartItems] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [isCartLoaded, setIsCartLoaded] = useState(false);
  const { user, isLoading: authLoading, isLoggedIn } = useAuth();
  const wishlistSyncUserRef = useRef(null);

  useEffect(() => {
    try {
      const savedCart = localStorage.getItem('cart');
      const savedFavorites = localStorage.getItem('favorites');
      if (savedCart) {
        const parsed = JSON.parse(savedCart);
        if (Array.isArray(parsed)) setCartItems(parsed);
      }
      if (savedFavorites) {
        const parsed = JSON.parse(savedFavorites);
        if (Array.isArray(parsed)) setFavorites(parsed);
      }
    } catch {
      localStorage.removeItem('cart');
      localStorage.removeItem('favorites');
    }
    setIsCartLoaded(true);
  }, []);

  useEffect(() => {
    if (!isCartLoaded) return;
    localStorage.setItem('cart', JSON.stringify(cartItems));
  }, [cartItems, isCartLoaded]);

  useEffect(() => {
    if (!isCartLoaded) return;
    localStorage.setItem('favorites', JSON.stringify(favorites));
  }, [favorites, isCartLoaded]);
 
  // Authenticated customers use the MySQL wishlist as the source of truth.
  // Guest favorites are merged into the account once at sign-in.
  useEffect(() => {
    if (!isCartLoaded || authLoading) return;
    if (!user) {
      wishlistSyncUserRef.current = null;
      return;
    }
    if (wishlistSyncUserRef.current === user.id) return;
    wishlistSyncUserRef.current = user.id;
    let cancelled = false;

    async function syncWishlist() {
      const localIds = [...new Set(favorites.map((item) => Number(item.productId || item.id))
        .filter((id) => Number.isSafeInteger(id) && id > 0))];
      if (localIds.length) {
        await fetch('/api/account/wishlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          cache: 'no-store',
          body: JSON.stringify({ productIds: localIds }),
        });
      }
      const response = await fetch('/api/account/wishlist', {
        credentials: 'same-origin',
        cache: 'no-store',
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'Unable to sync wishlist.');
      if (!cancelled) setFavorites(Array.isArray(body.products) ? body.products : []);
    }

    syncWishlist().catch((error) => {
      console.error('Unable to sync the VAGE wishlist:', error);
      wishlistSyncUserRef.current = null;
    });
    return () => { cancelled = true; };
  }, [isCartLoaded, authLoading, user?.id]);

  // A cart line is one exact product variant (product + size + colour).
  const addToCart = (product, variant, quantity = 1) => {
    const variantId = Number(variant?.variantId);
    const requestedQuantity = Number(quantity);
    if (
      !Number.isSafeInteger(variantId) ||
      variantId <= 0 ||
      !Number.isSafeInteger(requestedQuantity) ||
      requestedQuantity < 1
    ) {
      return false;
    }

    const id = `variant-${variantId}`;
    const unitPrice = Number(variant.unitPrice);
    const stockQuantity = Number(variant.stockQuantity || 0);
    const line = {
      ...product,
      id,
      productId: Number(product.productId || product.id),
      variantId,
      sku: variant.sku,
      size: variant.size,
      color: variant.color,
      unitPrice,
      price: formatPrice(unitPrice),
      stockQuantity,
      quantity: requestedQuantity,
    };

    setCartItems((previous) => {
      const existing = previous.find((item) => item.id === id);
      if (!existing) return [...previous, line];
      const nextQuantity = Math.min(
        stockQuantity,
        Number(existing.quantity || 0) + requestedQuantity
      );
      return previous.map((item) => item.id === id
        ? { ...item, quantity: nextQuantity, stockQuantity, unitPrice, price: formatPrice(unitPrice) }
        : item);
    });

    return true;
  };

  const removeFromCart = (lineId) => {
    setCartItems((previous) => previous.filter((item) => item.id !== lineId));
  };

  const updateQuantity = (lineId, quantity) => {
    const nextQuantity = Number(quantity);
    if (!Number.isSafeInteger(nextQuantity) || nextQuantity <= 0) {
      removeFromCart(lineId);
      return;
    }
    setCartItems((previous) => previous.map((item) => {
      if (item.id !== lineId) return item;
      const max = Number(item.stockQuantity || nextQuantity);
      return { ...item, quantity: Math.min(nextQuantity, Math.max(1, max)) };
    }));
  };

  const toggleFavorite = async (product) => {
    const productId = Number(product.productId || product.id);
    if (!Number.isSafeInteger(productId) || productId <= 0) return false;
    const exists = favorites.some((item) => Number(item.productId || item.id) === productId);
    const next = exists
      ? favorites.filter((item) => Number(item.productId || item.id) !== productId)
      : [...favorites, product];
    setFavorites(next);

    if (isLoggedIn && !authLoading) {
      try {
        const response = exists
          ? await fetch('/api/account/wishlist?productId=' + productId, {
              method: 'DELETE',
              credentials: 'same-origin',
              cache: 'no-store',
            })
          : await fetch('/api/account/wishlist', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'same-origin',
              cache: 'no-store',
              body: JSON.stringify({ productId }),
            });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.error || 'Unable to update wishlist.');
      } catch (error) {
        console.error('Unable to update the VAGE wishlist:', error);
        setFavorites((current) => exists
          ? [...current, product].filter((item, index, items) =>
              items.findIndex((entry) => Number(entry.productId || entry.id) === Number(item.productId || item.id)) === index)
          : current.filter((item) => Number(item.productId || item.id) !== productId));
        return false;
      }
    }
    return true;
  };

  const isFavorite = (productId) => favorites.some(
    (item) => Number(item.id) === Number(productId)
  );

  const clearCart = () => setCartItems([]);

  const cartTotal = cartItems.reduce((total, item) => {
    const unitPrice = Number.isFinite(Number(item.unitPrice))
      ? Number(item.unitPrice)
      : legacyPrice(item.price);
    return total + unitPrice * Number(item.quantity || 0);
  }, 0);

  const cartCount = cartItems.reduce((count, item) => count + Number(item.quantity || 0), 0);
  const hasUnselectedVariants = cartItems.some((item) => !Number.isSafeInteger(Number(item.variantId)));

  return (
    <CartContext.Provider
      value={{
        cartItems,
        favorites,
        addToCart,
        removeFromCart,
        updateQuantity,
        toggleFavorite,
        isFavorite,
        clearCart,
        cartTotal,
        cartCount,
        isCartLoaded,
        hasUnselectedVariants,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}
