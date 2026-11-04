'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext';

const CartContext = createContext();

export function useCart() {
  return useContext(CartContext);
}

const EMPTY_CART = { items: [], subtotal: 0, count: 0, hasIssues: false };

function readStoredFavorites() {
  try {
    const saved = JSON.parse(localStorage.getItem('favorites') || '[]');
    if (!Array.isArray(saved)) return [];
    return saved.filter((product) => Number.isSafeInteger(Number(product?.id)) && Number(product.id) > 0);
  } catch {
    return [];
  }
}

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
 * Signed-in carts and wishlists are stored in MySQL. Guest favorites stay in localStorage
 * and are merged into the customer's account when they sign in.
 * Every cart action resolves to { ok, error? } so pages can show a message instead of crashing.
 */
export function CartProvider({ children }) {
  const { user, isLoading: authLoading, setLoginModalOpen } = useAuth();
  const userId = user?.id ?? null;

  const [cart, setCart] = useState(EMPTY_CART);
  const [isCartLoaded, setIsCartLoaded] = useState(false);
  const [favorites, setFavorites] = useState([]);
  const [favoritesLoaded, setFavoritesLoaded] = useState(false);

  // Remove the legacy browser-side cart/orders from before these records moved to MySQL.
  useEffect(() => {
    try {
      localStorage.removeItem('cart');
      localStorage.removeItem('orders');
    } catch {
      /* storage unavailable */
    }
  }, []);

  // Guest favorites stay in localStorage. Signed-in favorites are loaded from MySQL.
  // On sign-in, merge guest favorites into the customer's account wishlist.
  useEffect(() => {
    if (authLoading) return undefined;
    let cancelled = false;

    const loadFavorites = async () => {
      setFavoritesLoaded(false);

      if (!userId) {
        setFavorites(readStoredFavorites());
        setFavoritesLoaded(true);
        return;
      }

      const guestFavorites = readStoredFavorites();
      try {
        let payload = await cartRequest('/api/account/wishlist');
        let guestFavoritesMerged = guestFavorites.length === 0;

        if (guestFavorites.length > 0) {
          const productIds = [...new Set(guestFavorites.map((product) => Number(product.id)))];
          try {
            await cartRequest('/api/account/wishlist', {
              method: 'POST',
              body: { productIds },
            });
            guestFavoritesMerged = true;
            try {
              payload = await cartRequest('/api/account/wishlist');
            } catch (refreshError) {
              console.error('Wishlist was saved, but the refreshed list could not be loaded:', refreshError);
              const existing = Array.isArray(payload.products) ? payload.products : [];
              const existingIds = new Set(existing.map((product) => Number(product.id)));
              payload = {
                products: [
                  ...existing,
                  ...guestFavorites.filter((product) => !existingIds.has(Number(product.id))),
                ],
              };
            }
          } catch (mergeError) {
            console.error('Unable to merge guest favorites into the account wishlist:', mergeError);
          }
        }

        if (cancelled) return;
        setFavorites(Array.isArray(payload.products) ? payload.products : []);
        if (guestFavoritesMerged) {
          try {
            localStorage.removeItem('favorites');
          } catch {
            /* storage unavailable */
          }
        }
      } catch (error) {
        console.error('Unable to load the account wishlist:', error);
        if (!cancelled) setFavorites(guestFavorites);
      } finally {
        if (!cancelled) setFavoritesLoaded(true);
      }
    };

    loadFavorites();
    return () => {
      cancelled = true;
    };
  }, [authLoading, userId]);

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

  const toggleFavorite = useCallback((product) => {
    const productId = Number(product?.id);
    if (!Number.isSafeInteger(productId) || productId <= 0) return;

    const wasFavorite = favorites.some((item) => Number(item.id) === productId);
    const nextFavorites = wasFavorite
      ? favorites.filter((item) => Number(item.id) !== productId)
      : [...favorites, product];

    setFavorites(nextFavorites);

    if (!userId) {
      try {
        localStorage.setItem('favorites', JSON.stringify(nextFavorites));
      } catch {
        /* storage unavailable */
      }
      return;
    }

    const mutation = wasFavorite
      ? cartRequest('/api/account/wishlist?productId=' + encodeURIComponent(productId), { method: 'DELETE' })
      : cartRequest('/api/account/wishlist', { method: 'POST', body: { productId } });

    mutation.catch(async (error) => {
      console.error('Unable to update the account wishlist:', error);
      try {
        const payload = await cartRequest('/api/account/wishlist');
        setFavorites(Array.isArray(payload.products) ? payload.products : []);
      } catch (refreshError) {
        console.error('Unable to refresh the account wishlist:', refreshError);
        setFavorites(favorites);
      }
    });
  }, [favorites, userId]);

  const isFavorite = useCallback(
    (productId) => favorites.some((item) => Number(item.id) === Number(productId)),
    [favorites]
  );

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
      favoritesLoaded,
      toggleFavorite,
      isFavorite,
    }),
    [cart, isCartLoaded, refreshCart, addToCart, updateQuantity, removeFromCart, clearCart, favorites, favoritesLoaded, toggleFavorite, isFavorite]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
