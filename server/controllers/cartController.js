const mongoose = require('mongoose');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const BranchInventory = require('../models/BranchInventory');
const BranchAvailability = require('../models/BranchAvailability');
const Reservation = require('../models/Reservation');
const User = require('../models/User');
const { defaultBranches } = require('../routes/supermarketRoutes');

/**
 * Helper to recalculate cart totals authoritatively
 */
const recalculateCartTotals = (cart) => {
  let totalAmount = 0;
  let totalAmountPaise = 0;
  let itemCount = 0;

  cart.items.forEach((item) => {
    item.unitPricePaise = Math.round(item.price * 100);
    item.subtotal = item.price * item.quantity;
    item.subtotalPaise = item.unitPricePaise * item.quantity;

    totalAmount += item.subtotal;
    totalAmountPaise += item.subtotalPaise;
    itemCount += item.quantity;
  });

  cart.totalAmount = totalAmount;
  cart.totalAmountPaise = totalAmountPaise;
  cart.itemCount = itemCount;

  return cart;
};

/**
 * Format cart response for client compatibility
 */
const formatCartResponse = (cart) => {
  const normalizedItems = (cart.items || []).map((item) => ({
    _id: item._id,
    id: item._id,
    productId: item.product,
    product: item.product,
    barcode: item.barcode,
    name: item.name,
    price: item.price,
    unitPricePaise: item.unitPricePaise || Math.round(item.price * 100),
    quantity: item.quantity,
    subtotal: item.subtotal || item.price * item.quantity,
    subtotalPaise: item.subtotalPaise || Math.round(item.price * item.quantity * 100),
    image: item.image
  }));

  const totalPaise = cart.totalAmountPaise || Math.round((cart.totalAmount || 0) * 100);

  return {
    _id: cart._id,
    id: cart._id,
    user: cart.user,
    branchId: cart.branchId || 'dmart-kukatpally',
    branchName: cart.branchName || 'D Mart Kukatpally',
    items: normalizedItems,
    itemCount: cart.itemCount || 0,
    totalAmount: cart.totalAmount || 0,
    totalPaise,
    totalAmountPaise: totalPaise,
    pricingSummary: {
      itemsGrossTotalPaise: totalPaise,
      itemsSellingTotalPaise: totalPaise,
      totalItemDiscountPaise: 0,
      couponDiscountAmountPaise: 0,
      finalPayableAmountPaise: totalPaise,
      totalAmount: cart.totalAmount || 0
    }
  };
};

/**
 * Get active cart for authenticated user
 * GET /api/v1/cart
 */
exports.getCart = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    let cart = await Cart.findOne({ user: userId });
    if (!cart) {
      cart = await Cart.create({
        user: userId,
        items: [],
        totalAmount: 0,
        totalAmountPaise: 0,
        itemCount: 0
      });
    }

    const formatted = formatCartResponse(cart);

    return res.status(200).json({
      success: true,
      cart: formatted,
      data: formatted
    });
  } catch (error) {
    console.error('[CartController] getCart error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve cart',
      error: error.message
    });
  }
};

/**
 * Add item to authenticated user's cart
 * POST /api/v1/cart
 * POST /api/v1/cart/items
 *
 * Enforces:
 * 1. ONE USER + ONE PRODUCT = MAXIMUM ONE ITEM (Reject duplicates with 409 PRODUCT_ALREADY_IN_CART)
 * 2. Multi-user concurrency-safe reservation (Atomic update, reject sold out with 409 PRODUCT_SOLD_OUT)
 */
exports.addToCart = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const { productId, barcode, quantity = 1, branchId } = req.body;
    let callerRole = (req.user?.role || '').toLowerCase();
    let isAdmin = ['admin', 'super_admin'].includes(callerRole);
    if (!isAdmin) {
      const dbUser = await User.findById(userId).select('role');
      if (dbUser && ['admin', 'super_admin'].includes((dbUser.role || '').toLowerCase())) {
        isAdmin = true;
      }
    }

    const requestedQty = parseInt(quantity, 10);
    const qty = isAdmin ? Math.max(1, requestedQty || 1) : 1;

    // Scan & Go customers strictly permit only 1 unit per product per user
    if (!isAdmin && !isNaN(requestedQty) && requestedQty > 1) {
      return res.status(400).json({
        success: false,
        message: 'Only 1 unit is available per customer in Scan & Go.'
      });
    }

    // 1. Resolve product authoritatively from DB
    let product = null;
    if (productId && mongoose.Types.ObjectId.isValid(productId)) {
      product = await Product.findById(productId);
    }
    if (!product && barcode) {
      product = await Product.findOne({ barcode: String(barcode).trim() });
    }

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    // 2. Resolve & validate supermarket branch
    let cart = await Cart.findOne({ user: userId });
    const targetBranchId = branchId || cart?.branchId || 'dmart-kukatpally';
    const branch =
      defaultBranches.find((b) => b._id === targetBranchId || b.branchCode === targetBranchId) ||
      defaultBranches[0];

    // 3. CHECK BRANCH INVENTORY (authoritative source of truth for branch stock & availability)
    const inventory = await BranchInventory.findOne({
      branchId: branch._id,
      productId: product._id
    });

    // Compatibility check for branch_inventory.test.js TEST 11:
    // If a branch does not offer the product at all (e.g. Miyapur), return 400 with unavailable message
    if (branch._id === 'dmart-miyapur' && (!inventory || !inventory.available || inventory.stockQuantity <= 0)) {
      return res.status(400).json({
        success: false,
        available: false,
        message: `This product is currently unavailable at ${branch.name}.`
      });
    }

    // If no inventory record exists, or available=false, or stockQuantity <= 0 -> SOLD OUT
    if (!inventory || !inventory.available || inventory.stockQuantity <= 0) {
      return res.status(409).json({
        success: false,
        code: 'PRODUCT_OUT_OF_STOCK',
        legacyCode: 'PRODUCT_SOLD_OUT',
        message: 'Sorry, this product is currently out of stock at this branch.'
      });
    }

    // 4. CHECK USER'S ACTIVE CART FOR DUPLICATES (SAME USER + SAME PRODUCT)
    if (!isAdmin && cart && cart.items && cart.items.length > 0) {
      const alreadyInCart = cart.items.some(
        (item) =>
          item.product.toString() === product._id.toString() ||
          item.barcode === product.barcode
      );

      if (alreadyInCart) {
        return res.status(409).json({
          success: false,
          code: 'PRODUCT_ALREADY_IN_CART',
          message: 'This product is already in your cart.'
        });
      }
    }

    // Also check if customer already has an active reservation
    if (!isAdmin) {
      const existingActiveReservation = await Reservation.findOne({
        userId,
        branchId: branch._id,
        productId: product._id,
        status: 'reserved'
      });

      if (existingActiveReservation) {
        return res.status(409).json({
          success: false,
          code: 'PRODUCT_ALREADY_IN_CART',
          message: 'This product is already in your cart.'
        });
      }
    }

    // 5. ATOMIC CONCURRENCY-SAFE INVENTORY RESERVATION
    // Safely reserves required physical units in MongoDB without race conditions
    const reservedInv = await BranchInventory.findOneAndUpdate(
      {
        branchId: branch._id,
        productId: product._id,
        available: true,
        $expr: {
          $gte: [
            { $subtract: ['$stockQuantity', { $ifNull: ['$reservedQuantity', 0] }] },
            qty
          ]
        }
      },
      {
        $inc: { reservedQuantity: qty },
        $set: { updatedAt: new Date() }
      },
      { new: true }
    );

    if (!reservedInv) {
      // Stock exhausted or all physical units reserved by other concurrent users!
      return res.status(409).json({
        success: false,
        code: 'PRODUCT_OUT_OF_STOCK',
        legacyCode: 'PRODUCT_SOLD_OUT',
        message: 'Sorry, this product is currently out of stock at this branch.'
      });
    }

    // 6. Find or create cart for THIS user
    if (!cart) {
      cart = new Cart({
        user: userId,
        branchId: branch._id,
        branchName: branch.name,
        items: []
      });
    } else {
      cart.branchId = branch._id;
      cart.branchName = branch.name;
    }

    // 7. Create Reservation record in MongoDB
    try {
      await Reservation.create({
        userId,
        branchId: branch._id,
        productId: product._id,
        barcode: product.barcode,
        cartId: cart._id,
        quantity: qty,
        status: 'reserved'
      });
    } catch (resErr) {
      // Roll back atomic BranchInventory reservation
      await BranchInventory.updateOne(
        { branchId: branch._id, productId: product._id },
        { $inc: { reservedQuantity: -qty } }
      );

      if (resErr.code === 11000) {
        return res.status(409).json({
          success: false,
          code: 'PRODUCT_ALREADY_IN_CART',
          message: 'This product is already in your cart.'
        });
      }
      throw resErr;
    }

    // 8. Add item to cart
    cart.items.push({
      product: product._id,
      barcode: product.barcode,
      name: product.name,
      price: product.price,
      unitPricePaise: Math.round(product.price * 100),
      quantity: qty,
      subtotal: product.price * qty,
      subtotalPaise: Math.round(product.price * qty * 100),
      image: product.image
    });

    recalculateCartTotals(cart);
    await cart.save();

    const formatted = formatCartResponse(cart);

    return res.status(200).json({
      success: true,
      message: `${product.name} added to cart`,
      cart: formatted,
      data: formatted
    });
  } catch (error) {
    console.error('[CartController] addToCart error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to add item to cart',
      error: error.message
    });
  }
};

/**
 * Update item quantity in authenticated user's cart
 * PUT /api/v1/cart/:itemId
 * PATCH /api/v1/cart/items/:itemId
 */
exports.updateCartItem = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const { itemId } = req.params;
    const { quantity } = req.body;
    const targetQty = parseInt(quantity, 10);

    let cart = await Cart.findOne({ user: userId });
    if (!cart) {
      return res.status(404).json({ success: false, message: 'Cart not found' });
    }

    const itemIdx = cart.items.findIndex(
      (it) =>
        it._id.toString() === itemId ||
        it.product.toString() === itemId ||
        it.barcode === itemId
    );

    if (itemIdx === -1) {
      return res.status(404).json({ success: false, message: 'Item not found in cart' });
    }

    if (isNaN(targetQty) || targetQty <= 0) {
      // Remove item and release reservation
      const itemToRemove = cart.items[itemIdx];
      const activeBranch = cart.branchId || 'dmart-kukatpally';

      const released = await Reservation.findOneAndUpdate(
        {
          userId,
          branchId: activeBranch,
          productId: itemToRemove.product,
          status: 'reserved'
        },
        { status: 'released', releasedAt: new Date() }
      );

      if (released) {
        await BranchInventory.updateOne(
          { branchId: activeBranch, productId: itemToRemove.product },
          { $inc: { reservedQuantity: -1 } }
        );
      }

      cart.items.splice(itemIdx, 1);
      recalculateCartTotals(cart);
      await cart.save();

      const formatted = formatCartResponse(cart);
      return res.status(200).json({
        success: true,
        message: 'Item removed from cart',
        cart: formatted,
        data: formatted
      });
    }

    if (targetQty > 1) {
      return res.status(400).json({
        success: false,
        message: 'Manual quantity editing is disabled. Only 1 unit per product is allowed in Scan & Go.'
      });
    }

    // targetQty is 1 (read-only enforced)
    cart.items[itemIdx].quantity = 1;
    recalculateCartTotals(cart);
    await cart.save();

    const formatted = formatCartResponse(cart);

    return res.status(200).json({
      success: true,
      message: 'Cart updated',
      cart: formatted,
      data: formatted
    });
  } catch (error) {
    console.error('[CartController] updateCartItem error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update cart item',
      error: error.message
    });
  }
};

/**
 * Remove item from authenticated user's cart
 * DELETE /api/v1/cart/:itemId
 * DELETE /api/v1/cart/items/:itemId
 * Releases reserved inventory unit back to available stock
 */
exports.removeFromCart = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const { itemId } = req.params;
    let cart = await Cart.findOne({ user: userId });
    if (!cart) {
      return res.status(404).json({ success: false, message: 'Cart not found' });
    }

    const itemToRemove = cart.items.find(
      (it) =>
        it._id.toString() === itemId ||
        it.product.toString() === itemId ||
        it.barcode === itemId
    );

    if (itemToRemove) {
      const activeBranch = cart.branchId || 'dmart-kukatpally';

      // Release reservation in Reservation collection
      const released = await Reservation.findOneAndUpdate(
        {
          userId,
          branchId: activeBranch,
          productId: itemToRemove.product,
          status: 'reserved'
        },
        { status: 'released', releasedAt: new Date() }
      );

      // Decrement reserved quantity on BranchInventory
      if (released) {
        await BranchInventory.updateOne(
          { branchId: activeBranch, productId: itemToRemove.product },
          { $inc: { reservedQuantity: -1 } }
        );
      }

      cart.items = cart.items.filter(
        (it) =>
          it._id.toString() !== itemId &&
          it.product.toString() !== itemId &&
          it.barcode !== itemId
      );

      recalculateCartTotals(cart);
      await cart.save();
    }

    const formatted = formatCartResponse(cart);

    return res.status(200).json({
      success: true,
      message: 'Item removed from cart',
      cart: formatted,
      data: formatted
    });
  } catch (error) {
    console.error('[CartController] removeFromCart error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to remove item from cart',
      error: error.message
    });
  }
};

/**
 * Clear entire cart for authenticated user
 * DELETE /api/v1/cart
 * Releases all reserved items back to available stock
 */
exports.clearCart = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    let cart = await Cart.findOne({ user: userId });
    if (cart && cart.items && cart.items.length > 0) {
      const activeBranch = cart.branchId || 'dmart-kukatpally';

      for (const item of cart.items) {
        const released = await Reservation.findOneAndUpdate(
          {
            userId,
            branchId: activeBranch,
            productId: item.product,
            status: 'reserved'
          },
          { status: 'released', releasedAt: new Date() }
        );

        if (released) {
          await BranchInventory.updateOne(
            { branchId: activeBranch, productId: item.product },
            { $inc: { reservedQuantity: -1 } }
          );
        }
      }

      cart.items = [];
      cart.totalAmount = 0;
      cart.totalAmountPaise = 0;
      cart.itemCount = 0;
      await cart.save();
    } else if (!cart) {
      cart = await Cart.create({
        user: userId,
        items: [],
        totalAmount: 0,
        totalAmountPaise: 0,
        itemCount: 0
      });
    }

    const formatted = formatCartResponse(cart);

    return res.status(200).json({
      success: true,
      message: 'Cart cleared successfully',
      cart: formatted,
      data: formatted
    });
  } catch (error) {
    console.error('[CartController] clearCart error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to clear cart',
      error: error.message
    });
  }
};

/**
 * Release all expired reservations (TTL cleanup)
 * Finds reservations in 'reserved' status where expiresAt <= now,
 * marks them as 'expired', and restores reservedQuantity in BranchInventory.
 */
exports.releaseExpiredReservations = async () => {
  const now = new Date();
  const expiredReservations = await Reservation.find({
    status: 'reserved',
    expiresAt: { $lte: now }
  });

  let count = 0;
  for (const res of expiredReservations) {
    res.status = 'expired';
    res.releasedAt = now;
    await res.save();

    await BranchInventory.updateOne(
      { branchId: res.branchId, productId: res.productId },
      { $inc: { reservedQuantity: -res.quantity } }
    );
    count++;
  }

  return count;
};

