const mongoose = require('mongoose');
const BranchInventory = require('../models/BranchInventory');
const Product = require('../models/Product');
const { defaultBranches } = require('../routes/supermarketRoutes');
const { successResponse, errorResponse } = require('../utils/apiResponse');

/**
 * Get all inventory records for a specific branch
 * GET /api/v1/branches/:branchId/inventory
 */
exports.getBranchInventory = async (req, res) => {
  try {
    const { branchId } = req.params;
    const branch =
      defaultBranches.find((b) => b._id === branchId || b.branchCode === branchId) ||
      defaultBranches[0];

    const inventoryRecords = await BranchInventory.find({ branchId: branch._id })
      .populate('productId')
      .sort({ updatedAt: -1 });

    const formatted = inventoryRecords.map((inv) => ({
      _id: inv._id,
      id: inv._id,
      branchId: inv.branchId,
      productId: inv.productId?._id || inv.productId,
      product: inv.productId,
      stockQuantity: inv.stockQuantity,
      available: inv.available && inv.stockQuantity > 0,
      updatedAt: inv.updatedAt
    }));

    return successResponse(res, `Inventory for branch ${branch.name} fetched successfully`, formatted);
  } catch (error) {
    console.error('[BranchInventoryController] getBranchInventory error:', error);
    return errorResponse(res, 'Failed to fetch branch inventory', error.message, 500);
  }
};

/**
 * Create or Upsert inventory record for a product at a branch
 * POST /api/v1/branches/:branchId/inventory
 */
exports.setBranchInventory = async (req, res) => {
  try {
    const { branchId } = req.params;
    const { productId, stockQuantity = 0, available = true } = req.body;

    if (!productId) {
      return errorResponse(res, 'Product ID is required', null, 400);
    }

    const branch =
      defaultBranches.find((b) => b._id === branchId || b.branchCode === branchId) ||
      defaultBranches[0];

    const product = await Product.findById(productId);
    if (!product) {
      return errorResponse(res, 'Product not found', null, 404);
    }

    const stock = Math.max(0, parseInt(stockQuantity, 10) || 0);
    const isAvailable = stock > 0 ? Boolean(available) : false;

    const inventory = await BranchInventory.findOneAndUpdate(
      { branchId: branch._id, productId: product._id },
      {
        branchId: branch._id,
        productId: product._id,
        stockQuantity: stock,
        available: isAvailable,
        updatedAt: new Date()
      },
      { upsert: true, new: true, runValidators: true }
    ).populate('productId');

    return successResponse(res, 'Branch inventory updated successfully', inventory);
  } catch (error) {
    console.error('[BranchInventoryController] setBranchInventory error:', error);
    return errorResponse(res, 'Failed to set branch inventory', error.message, 500);
  }
};

/**
 * Update existing inventory record
 * PUT /api/v1/branches/:branchId/inventory/:productId
 */
exports.updateBranchInventory = async (req, res) => {
  try {
    const { branchId, productId } = req.params;
    const { stockQuantity, available } = req.body;

    const branch =
      defaultBranches.find((b) => b._id === branchId || b.branchCode === branchId) ||
      defaultBranches[0];

    const updateData = { updatedAt: new Date() };

    if (stockQuantity !== undefined) {
      const stock = Math.max(0, parseInt(stockQuantity, 10) || 0);
      updateData.stockQuantity = stock;
      if (stock === 0) {
        updateData.available = false;
      }
    }

    if (available !== undefined && updateData.stockQuantity !== 0) {
      updateData.available = Boolean(available);
    }

    const inventory = await BranchInventory.findOneAndUpdate(
      { branchId: branch._id, productId },
      updateData,
      { new: true, runValidators: true }
    ).populate('productId');

    if (!inventory) {
      return errorResponse(res, 'Inventory record not found for this product and branch', null, 404);
    }

    return successResponse(res, 'Branch inventory updated successfully', inventory);
  } catch (error) {
    console.error('[BranchInventoryController] updateBranchInventory error:', error);
    return errorResponse(res, 'Failed to update branch inventory', error.message, 500);
  }
};

/**
 * Delete inventory record
 * DELETE /api/v1/branches/:branchId/inventory/:productId
 */
exports.deleteBranchInventory = async (req, res) => {
  try {
    const { branchId, productId } = req.params;
    const branch =
      defaultBranches.find((b) => b._id === branchId || b.branchCode === branchId) ||
      defaultBranches[0];

    const deleted = await BranchInventory.findOneAndDelete({ branchId: branch._id, productId });
    if (!deleted) {
      return errorResponse(res, 'Inventory record not found', null, 404);
    }

    return successResponse(res, 'Branch inventory deleted successfully', { productId, branchId: branch._id });
  } catch (error) {
    console.error('[BranchInventoryController] deleteBranchInventory error:', error);
    return errorResponse(res, 'Failed to delete branch inventory', error.message, 500);
  }
};
