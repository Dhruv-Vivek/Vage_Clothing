'use client';

import { createContext, useContext, useEffect, useState } from 'react';

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

  const toggleFavorite = (product) => {
    setFavorites((previous) => {
      const exists = previous.some((item) => Number(item.id) === Number(product.id));
      return exists
        ? previous.filter((item) => Number(item.id) !== Number(product.id))
        : [...previous, product];
    });
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
