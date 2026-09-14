const mongoose = require('mongoose');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const BranchInventory = require('../models/BranchInventory');
const BranchAvailability = require('../models/BranchAvailability');
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
 */
exports.addToCart = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const { productId, barcode, quantity = 1, branchId } = req.body;
    const qty = Math.max(1, parseInt(quantity, 10) || 1);

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

    // 3. Check BranchInventory collection (authoritative source of truth for branch stock & availability)
    const inventory = await BranchInventory.findOne({
      branchId: branch._id,
      productId: product._id
    });

    // Rule: If no inventory record exists, or available=false, or stock=0 -> NOT AVAILABLE
    if (!inventory || !inventory.available || inventory.stockQuantity <= 0) {
      return res.status(400).json({
        success: false,
        available: false,
        message: `This product is currently unavailable at ${branch.name}.`
      });
    }

    if (inventory.stockQuantity < qty) {
      return res.status(400).json({
        success: false,
        available: true,
        message: `Only ${inventory.stockQuantity} items available for ${product.name} at ${branch.name}.`
      });
    }

    // 4. Find or create cart for THIS user
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

    // 5. Update or add item
    const existingIdx = cart.items.findIndex(
      (item) =>
        item.product.toString() === product._id.toString() ||
        item.barcode === product.barcode
    );

    if (existingIdx > -1) {
      const newQty = cart.items[existingIdx].quantity + qty;
      if (newQty > inventory.stockQuantity) {
        return res.status(400).json({
          success: false,
          message: `Cannot add more. Only ${inventory.stockQuantity} items available in stock at ${branch.name}.`
        });
      }
      cart.items[existingIdx].quantity = newQty;
      cart.items[existingIdx].price = product.price; // authoritative price
    } else {
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
    }

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
      // Remove item
      cart.items.splice(itemIdx, 1);
    } else {
      // Verify branch stock
      const product = await Product.findById(cart.items[itemIdx].product);
      const inventory = await BranchInventory.findOne({
        branchId: cart.branchId || 'dmart-kukatpally',
        productId: cart.items[itemIdx].product
      });
      const maxStock = inventory ? inventory.stockQuantity : (product ? product.stock : 0);
      if (targetQty > maxStock) {
        return res.status(400).json({
          success: false,
          message: `Only ${maxStock} items available in stock at this branch`
        });
      }
      cart.items[itemIdx].quantity = targetQty;
    }

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

    cart.items = cart.items.filter(
      (it) =>
        it._id.toString() !== itemId &&
        it.product.toString() !== itemId &&
        it.barcode !== itemId
    );

    recalculateCartTotals(cart);
    await cart.save();

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
 */
exports.clearCart = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    let cart = await Cart.findOne({ user: userId });
    if (cart) {
      cart.items = [];
      cart.totalAmount = 0;
      cart.totalAmountPaise = 0;
      cart.itemCount = 0;
      await cart.save();
    } else {
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
