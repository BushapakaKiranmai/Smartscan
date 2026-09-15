import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import api from '../api/client';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';

const CartContext = createContext(null);

export const formatPaise = (paise, fallbackRupees = null) => {
  if (typeof paise === 'number' && !isNaN(paise) && paise > 0) {
    return (paise / 100).toLocaleString('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2
    });
  }
  if (typeof fallbackRupees === 'number' && !isNaN(fallbackRupees) && fallbackRupees > 0) {
    return Number(fallbackRupees).toLocaleString('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2
    });
  }
  if (paise === 0 || fallbackRupees === 0) {
    return '₹0.00';
  }
  return '₹0.00';
};

export const formatRupees = (rupees) => {
  if (typeof rupees !== 'number' || isNaN(rupees)) return '₹0.00';
  return Number(rupees).toLocaleString('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2
  });
};

export const CartProvider = ({ children }) => {
  const { isAuthenticated, user } = useAuth();
  const toast = useToast();

  const userId = user?._id || user?.id || null;
  const storageKey = userId ? `smartscan_cart_${userId}` : null;

  // Clean legacy un-namespaced shared cart key so past sessions never leak
  useEffect(() => {
    try {
      localStorage.removeItem('smartscan_cart');
    } catch {}
  }, []);

  // Initialize items scoped to the specific authenticated user
  const [items, setItems] = useState(() => {
    if (!storageKey) return [];
    try {
      const saved = localStorage.getItem(storageKey);
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed)) return [];

      return parsed.map((item) => {
        const rawPrice = item.price ?? (item.unitPricePaise ? item.unitPricePaise / 100 : (item.sellingPricePaise ? item.sellingPricePaise / 100 : 0));
        const price = Number(rawPrice) || 0;
        const qty = Math.max(1, parseInt(item.quantity, 10) || 1);
        const unitPricePaise = item.unitPricePaise ?? item.sellingPricePaise ?? Math.round(price * 100);
        const subtotalPaise = item.subtotalPaise ?? item.lineTotalSellingPricePaise ?? (unitPricePaise * qty);
        const subtotal = item.subtotal ?? (price * qty);

        return {
          ...item,
          productId: item.productId || item._id || item.id,
          _id: item._id || item.productId || item.id,
          id: item.id || item.productId || item._id,
          price,
          quantity: qty,
          unitPricePaise,
          sellingPricePaise: unitPricePaise,
          subtotal,
          subtotalPaise,
          lineTotalSellingPricePaise: subtotalPaise,
          availableStock: item.availableStock ?? item.stock ?? 999,
          stock: item.stock ?? item.availableStock ?? 999
        };
      });
    } catch {
      return [];
    }
  });

  const [loading, setLoading] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [cartDocId, setCartDocId] = useState(null);

  // Sync state to user-specific localStorage key
  useEffect(() => {
    if (!storageKey) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(items));
    } catch (e) {
      console.warn('[Cart] Failed to save cart to user storage:', e);
    }
  }, [items, storageKey]);

  // Fetch authoritatively from backend when user logs in or switches
  const fetchBackendCart = useCallback(async (currentUid) => {
    if (!currentUid) {
      console.log('[CART] Clearing frontend cart');
      setItems([]);
      setCartDocId(null);
      return;
    }

    console.log(`[CART] Loading NEW user's cart`);
    console.log(`[CART] Loading cart for user: ${currentUid}`);

    try {
      setLoading(true);
      const res = await api.get('/cart');
      const cartData = res.data?.cart || res.cart || res.data || {};
      const backendItems = cartData.items || [];
      const cId = cartData._id || cartData.id || 'none';
      setCartDocId(cId);

      console.log(`[CART] Cart ID: ${cId}`);
      console.log(`[CART] Items loaded: ${backendItems.length}`);

      const normalized = backendItems.map((item) => {
        const pId = item.productId || item.product?._id || item.product || item._id;
        const price = Number(item.price) || 0;
        const qty = Number(item.quantity) || 1;
        const unitPricePaise = item.unitPricePaise || Math.round(price * 100);
        const subtotalPaise = item.subtotalPaise || (unitPricePaise * qty);
        const subtotal = item.subtotal || (price * qty);

        return {
          productId: pId,
          _id: item._id || pId,
          id: pId,
          barcode: item.barcode,
          name: item.name || item.product?.name || 'Item',
          price,
          unitPricePaise,
          sellingPricePaise: unitPricePaise,
          quantity: qty,
          subtotal,
          subtotalPaise,
          lineTotalSellingPricePaise: subtotalPaise,
          image: item.image || item.product?.image || null,
          availableStock: item.stock || item.product?.stock || 999,
          stock: item.stock || item.product?.stock || 999
        };
      });

      setItems(normalized);
      const userKey = `smartscan_cart_${currentUid}`;
      localStorage.setItem(userKey, JSON.stringify(normalized));
    } catch (err) {
      console.warn('[Cart] Fetch error, falling back to user cache:', err.message);
      // Read from user-specific cache
      const userKey = `smartscan_cart_${currentUid}`;
      const saved = localStorage.getItem(userKey);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setItems(parsed);
          console.log(`[CART] Items loaded from user cache: ${parsed.length}`);
        } catch {
          setItems([]);
        }
      } else {
        setItems([]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Watch authentication state changes to ensure strict isolation
  useEffect(() => {
    if (userId) {
      console.log(`[AUTH] Current user ID: ${userId}`);
      fetchBackendCart(userId);
    } else {
      console.log('[CART] Clearing frontend cart');
      setItems([]);
      setCartDocId(null);
    }
  }, [userId, fetchBackendCart]);

  // Listen for explicit logout event
  useEffect(() => {
    const handleLogout = (e) => {
      const loggedOutUid = e.detail?.userId;
      console.log(`[AUTH] Logging out user: ${loggedOutUid || 'unknown'}`);
      console.log('[CART] Clearing frontend cart');
      setItems([]);
      setCartDocId(null);
      if (loggedOutUid) {
        try {
          localStorage.removeItem(`smartscan_cart_${loggedOutUid}`);
        } catch {}
      }
    };

    window.addEventListener('smartscan-logout', handleLogout);
    return () => window.removeEventListener('smartscan-logout', handleLogout);
  }, []);

  // Derived calculations
  const itemCount = useMemo(() => {
    return items.reduce((acc, item) => acc + (item.quantity || 1), 0);
  }, [items]);

  const totalAmount = useMemo(() => {
    return items.reduce((acc, item) => acc + ((item.price || 0) * (item.quantity || 1)), 0);
  }, [items]);

  const totalPaise = useMemo(() => {
    return items.reduce((acc, item) => {
      const uPaise = item.unitPricePaise ?? Math.round((item.price || 0) * 100);
      return acc + (uPaise * (item.quantity || 1));
    }, 0);
  }, [items]);

  const pricingSummary = useMemo(() => {
    const paise = totalPaise > 0 ? totalPaise : Math.round(totalAmount * 100);
    return {
      itemsGrossTotalPaise: paise,
      itemsSellingTotalPaise: paise,
      totalItemDiscountPaise: 0,
      couponDiscountAmountPaise: 0,
      finalPayableAmountPaise: paise,
      totalAmount
    };
  }, [totalPaise, totalAmount]);

  const cart = useMemo(() => {
    return {
      items,
      itemCount,
      totalAmount,
      totalPaise,
      pricingSummary
    };
  }, [items, itemCount, totalAmount, totalPaise, pricingSummary]);

  // Add Item to user's cart
  const addItem = async (barcodeOrProduct, productId = null, quantity = 1, extraDetails = null) => {
    let itemBarcode = '';
    let itemProductId = productId;
    let itemName = '';
    let itemPrice = 0;
    let itemStock = 999;
    let itemImage = null;

    if (typeof barcodeOrProduct === 'object' && barcodeOrProduct !== null) {
      itemBarcode = String(barcodeOrProduct.barcode || barcodeOrProduct.baseBarcode || '').trim();
      itemProductId = barcodeOrProduct.id || barcodeOrProduct._id || barcodeOrProduct.productId || itemProductId;
      itemName = barcodeOrProduct.name || '';
      itemPrice = Number(barcodeOrProduct.price ?? (barcodeOrProduct.sellingPricePaise ? barcodeOrProduct.sellingPricePaise / 100 : (barcodeOrProduct.unitPricePaise ? barcodeOrProduct.unitPricePaise / 100 : 0))) || 0;
      itemStock = barcodeOrProduct.stock !== undefined ? barcodeOrProduct.stock : (barcodeOrProduct.availableStock ?? barcodeOrProduct.stockQuantity ?? itemStock);
      itemImage = barcodeOrProduct.image || barcodeOrProduct.images?.[0]?.url || null;
    } else {
      itemBarcode = String(barcodeOrProduct || '').trim();
      if (extraDetails) {
        const pObj = extraDetails.product || extraDetails;
        itemName = pObj.name || extraDetails.name || itemName;
        const rawP = pObj.price ?? (extraDetails.sellingPricePaise ? extraDetails.sellingPricePaise / 100 : (extraDetails.mrpPaise ? extraDetails.mrpPaise / 100 : itemPrice));
        itemPrice = Number(rawP) || 0;
        itemStock = extraDetails.availableStock ?? extraDetails.stockQuantity ?? pObj.stock ?? itemStock;
        itemProductId = pObj._id || pObj.id || itemProductId;
        itemImage = pObj.image || pObj.images?.[0]?.url || extraDetails.image || null;
      }
    }

    const numQty = Math.max(1, parseInt(quantity, 10) || 1);
    const unitPricePaise = Math.round(itemPrice * 100);

    console.log(`[CART] Adding product for user: ${userId || 'guest'}`);

    // Client-side quick check: reject if already in cart
    const existing = items.some(
      (i) =>
        (itemBarcode && i.barcode === itemBarcode) ||
        (itemProductId && (i.productId === itemProductId || i._id === itemProductId || i.id === itemProductId))
    );

    if (existing) {
      toast.warning('This product is already in your cart.');
      return false;
    }

    // Backend is the source of truth for concurrency & reservations
    if (userId) {
      try {
        const res = await api.post('/cart/items', {
          productId: itemProductId,
          barcode: itemBarcode,
          quantity: 1
        });

        const cartData = res.data?.cart || res.cart || res.data || {};
        const backendItems = cartData.items || [];
        if (backendItems.length > 0) {
          const normalized = backendItems.map((item) => {
            const pId = item.productId || item.product?._id || item.product || item._id;
            const price = Number(item.price) || 0;
            const qty = 1; // Strict single item enforcement
            const uPaise = item.unitPricePaise || Math.round(price * 100);
            return {
              productId: pId,
              _id: item._id || pId,
              id: pId,
              barcode: item.barcode,
              name: item.name || item.product?.name || 'Item',
              price,
              unitPricePaise: uPaise,
              sellingPricePaise: uPaise,
              quantity: qty,
              subtotal: price,
              subtotalPaise: uPaise,
              lineTotalSellingPricePaise: uPaise,
              image: item.image || item.product?.image || null,
              availableStock: item.stock || item.product?.stock || 999,
              stock: item.stock || item.product?.stock || 999
            };
          });
          setItems(normalized);
        } else {
          // Fallback append single item if backend returned empty array
          const newItem = {
            productId: itemProductId || `prod_${Date.now()}`,
            _id: itemProductId || `prod_${Date.now()}`,
            id: itemProductId || `prod_${Date.now()}`,
            barcode: itemBarcode,
            name: itemName || `Item ${itemBarcode}`,
            price: itemPrice,
            unitPricePaise,
            sellingPricePaise: unitPricePaise,
            stock: itemStock,
            availableStock: itemStock,
            image: itemImage,
            images: itemImage ? [{ url: itemImage }] : [],
            quantity: 1,
            subtotal: itemPrice,
            subtotalPaise: unitPricePaise,
            lineTotalSellingPricePaise: unitPricePaise
          };
          setItems((prev) => [...prev, newItem]);
        }

        toast.success('Product added to cart!');
        return true;
      } catch (err) {
        const code = err.response?.data?.code || err.code;
        const status = err.response?.status || err.status;
        if (code === 'PRODUCT_ALREADY_IN_CART') {
          toast.warning('This product is already in your cart.');
        } else if (code === 'PRODUCT_SOLD_OUT' || status === 409) {
          toast.error('Product not found or sold out.');
        } else {
          toast.error(err.response?.data?.message || 'Failed to add item to cart');
        }
        throw err;
      }
    } else {
      // Guest local state mode
      const newItem = {
        productId: itemProductId || `prod_${Date.now()}`,
        _id: itemProductId || `prod_${Date.now()}`,
        id: itemProductId || `prod_${Date.now()}`,
        barcode: itemBarcode,
        name: itemName || `Item ${itemBarcode}`,
        price: itemPrice,
        unitPricePaise,
        sellingPricePaise: unitPricePaise,
        stock: itemStock,
        availableStock: itemStock,
        image: itemImage,
        images: itemImage ? [{ url: itemImage }] : [],
        quantity: 1,
        subtotal: itemPrice,
        subtotalPaise: unitPricePaise,
        lineTotalSellingPricePaise: unitPricePaise
      };
      setItems((prev) => [...prev, newItem]);
      toast.success('Product added to cart!');
      return true;
    }
  };

  // Update item quantity (Read-only single item rule)
  const updateQuantity = async (productId, newQuantity) => {
    const qty = parseInt(newQuantity, 10);
    if (isNaN(qty) || qty <= 0) {
      removeItem(productId);
      return;
    }

    if (qty > 1) {
      toast.warning('Only 1 unit per product is allowed in Scan & Go.');
      return;
    }
  };

  // Remove item
  const removeItem = async (productId) => {
    setItems((prevItems) =>
      prevItems.filter((item) => item.productId !== productId && item.id !== productId && item._id !== productId && item.barcode !== productId)
    );
    toast.info('Item removed from cart');
    console.log(`[CART] Cart updated for user: ${userId || 'guest'}`);

    if (userId) {
      try {
        await api.delete(`/cart/items/${productId}`);
      } catch (err) {
        console.warn('[Cart] Server item delete notice:', err.message);
      }
    }
  };

  // Clear cart
  const clearCart = async () => {
    setItems([]);
    if (storageKey) {
      try {
        localStorage.removeItem(storageKey);
      } catch {}
    }
    console.log(`[CART] Clearing frontend cart for user: ${userId || 'guest'}`);
    toast.info('Cart cleared');

    if (userId) {
      try {
        await api.delete('/cart');
      } catch (err) {
        console.warn('[Cart] Server clear notice:', err.message);
      }
    }
  };

  const applyCoupon = () => toast.info('Coupons are currently unavailable');
  const removeCoupon = () => {};
  const refreshCart = () => {
    if (userId) fetchBackendCart(userId);
  };

  const value = {
    cart,
    items,
    itemCount,
    totalAmount,
    totalPaise,
    pricingSummary,
    appliedCoupon: null,
    loading,
    isDrawerOpen,
    setIsDrawerOpen,
    formatPaise,
    formatRupees,
    addItem,
    updateQuantity,
    removeItem,
    clearCart,
    applyCoupon,
    removeCoupon,
    refreshCart
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};

export default CartContext;
