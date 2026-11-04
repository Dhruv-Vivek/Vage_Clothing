'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext';

const CartContext = createContext();

export function useCart() {
  return useContext(CartContext);
}

const EMPTY_CART = { items: [], subtotal: 0, count: 0, hasIssues: false };

async function cartRequest(url, { method = 'GET', body } = {}) {
  const response = await fetch(url, {
    method,
    credentials: 'same-origin',
    cache: 'no-store',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'Something went wrong. Please try again.');
  return payload;
}

/**
 * The cart now lives in MySQL (carts / cart_items) for the signed-in customer, so the order can be
 * built from it by the place_order procedure. Favourites remain a browser-only convenience.
 * Every cart action resolves to { ok, error? } so pages can show a message instead of crashing.
 */
export function CartProvider({ children }) {
  const { user, isLoading: authLoading, setLoginModalOpen } = useAuth();
  const userId = user?.id ?? null;

  const [cart, setCart] = useState(EMPTY_CART);
  const [isCartLoaded, setIsCartLoaded] = useState(false);
  const [favorites, setFavorites] = useState([]);
  const [favoritesLoaded, setFavoritesLoaded] = useState(false);

  // Favourites (browser only). Also drop the old browser-side cart/orders from before orders were stored in MySQL.
  useEffect(() => {
    try {
      localStorage.removeItem('cart');
      localStorage.removeItem('orders');
      const saved = localStorage.getItem('favorites');
      if (saved) setFavorites(JSON.parse(saved));
    } catch {
      try {
        localStorage.removeItem('favorites');
      } catch {
        /* storage unavailable */
      }
    }
    setFavoritesLoaded(true);
  }, []);

  useEffect(() => {
    if (!favoritesLoaded) return;
    try {
      localStorage.setItem('favorites', JSON.stringify(favorites));
    } catch {
      /* storage unavailable */
    }
  }, [favorites, favoritesLoaded]);

  const refreshCart = useCallback(async () => {
    if (!userId) {
      setCart(EMPTY_CART);
      return;
    }
    try {
      setCart(await cartRequest('/api/cart'));
    } catch (error) {
      console.error('Unable to load cart:', error);
    }
  }, [userId]);

  // Reload whenever the signed-in customer changes (login, logout, switching accounts).
  useEffect(() => {
    if (authLoading) return undefined;
    let cancelled = false;
    (async () => {
      await refreshCart();
      if (!cancelled) setIsCartLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [authLoading, refreshCart]);

  const run = useCallback(async (request) => {
    try {
      setCart(await request());
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  }, []);

  /** Add a specific size/colour. Guests are asked to log in first. */
  const addToCart = useCallback(
    (variantId, quantity = 1) => {
      if (!userId) {
        setLoginModalOpen(true);
        return Promise.resolve({ ok: false, needsLogin: true, error: 'Please log in to add items to your cart.' });
      }
      return run(() => cartRequest('/api/cart/items', { method: 'POST', body: { variantId, quantity } }));
    },
    [userId, run, setLoginModalOpen]
  );

  const updateQuantity = useCallback(
    (variantId, quantity) =>
      run(() => cartRequest(`/api/cart/items/${variantId}`, { method: 'PATCH', body: { quantity } })),
    [run]
  );

  const removeFromCart = useCallback(
    (variantId) => run(() => cartRequest(`/api/cart/items/${variantId}`, { method: 'DELETE' })),
    [run]
  );

  /** Called after an order is placed (the database has already emptied the cart). */
  const clearCart = useCallback(() => setCart(EMPTY_CART), []);

  const toggleFavorite = (product) => {
    setFavorites((prev) =>
      prev.find((item) => item.id === product.id) ? prev.filter((item) => item.id !== product.id) : [...prev, product]
    );
  };
  const isFavorite = (productId) => favorites.some((item) => item.id === productId);

  const value = useMemo(
    () => ({
      cartItems: cart.items,
      cartTotal: cart.subtotal,
      cartCount: cart.count,
      cartHasIssues: cart.hasIssues,
      isCartLoaded,
      refreshCart,
      addToCart,
      updateQuantity,
      removeFromCart,
      clearCart,
      favorites,
      toggleFavorite,
      isFavorite,
    }),
    // toggleFavorite/isFavorite are recreated each render on purpose (they close over favorites)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cart, isCartLoaded, refreshCart, addToCart, updateQuantity, removeFromCart, clearCart, favorites]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
