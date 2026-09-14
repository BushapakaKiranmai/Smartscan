const express = require('express');
const router = express.Router();
const { successResponse, errorResponse } = require('../utils/apiResponse');
const { defaultBranches } = require('./supermarketRoutes');
const Product = require('../models/Product');
const BranchInventory = require('../models/BranchInventory');
const BranchAvailability = require('../models/BranchAvailability');
const branchInventoryController = require('../controllers/branchInventoryController');

// Haversine formula to compute distance in km
const calculateDistanceKm = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// Format distance nicely: "1.2 km away" or "850 m away"
const formatDistance = (km) => {
  if (km < 1) {
    return `${Math.round(km * 1000)} m away`;
  }
  return `${km.toFixed(1)} km away`;
};

// Filter out legacy aliases for clean client display
const getActiveBranches = () => defaultBranches.filter((b) => !b._id.startsWith('br-'));

// GET /api/v1/branches
router.get('/', (req, res) => {
  const branches = getActiveBranches();
  return successResponse(res, 'Branches fetched successfully', branches);
});

// GET /api/v1/branches/nearby?lat=...&lng=...
router.get('/nearby', (req, res) => {
  const lat = parseFloat(req.query.lat);
  const lng = parseFloat(req.query.lng);

  const branches = getActiveBranches().map((branch) => {
    if (!isNaN(lat) && !isNaN(lng) && branch.latitude && branch.longitude) {
      const dist = calculateDistanceKm(lat, lng, branch.latitude, branch.longitude);
      return {
        ...branch,
        distanceKm: parseFloat(dist.toFixed(2)),
        distanceText: formatDistance(dist)
      };
    }
    return {
      ...branch,
      distanceKm: null,
      distanceText: null
    };
  });

  // If coordinates provided, sort by nearest first
  if (!isNaN(lat) && !isNaN(lng)) {
    branches.sort((a, b) => (a.distanceKm ?? 9999) - (b.distanceKm ?? 9999));
  }

  return successResponse(res, 'Nearby branches fetched successfully', branches);
});

// GET /api/v1/branches/supermarket/:supermarketId
router.get('/supermarket/:supermarketId', (req, res) => {
  const filtered = defaultBranches.filter(
    (b) => b.supermarketId === req.params.supermarketId && !b._id.startsWith('br-')
  );
  return successResponse(
    res,
    'Supermarket branches fetched successfully',
    filtered.length > 0 ? filtered : getActiveBranches()
  );
});

// ==========================================
// Branch Inventory Endpoints (Admin & Internal)
// ==========================================
router.get('/:branchId/inventory', branchInventoryController.getBranchInventory);
router.post('/:branchId/inventory', branchInventoryController.setBranchInventory);
router.put('/:branchId/inventory/:productId', branchInventoryController.updateBranchInventory);
router.delete('/:branchId/inventory/:productId', branchInventoryController.deleteBranchInventory);

// GET /api/v1/branches/:branchId/availability/:barcode
// Check whether a scanned product barcode is available at this branch
router.get(['/:branchId/availability/:barcode', '/:branchId/products/:barcode'], async (req, res) => {
  try {
    const { branchId, barcode } = req.params;
    const cleanBarcode = String(barcode).trim();

    const branch =
      defaultBranches.find((b) => b._id === branchId || b.branchCode === branchId) ||
      defaultBranches[0];

    const product = await Product.findOne({ barcode: cleanBarcode });
    if (!product) {
      return res.status(404).json({
        success: false,
        available: false,
        message: 'Product not found in system catalog'
      });
    }

    // Check BranchInventory collection (authoritative source of truth)
    const inventory = await BranchInventory.findOne({
      branchId: branch._id,
      productId: product._id
    });

    let isAvailable = false;
    let availableStock = 0;

    if (inventory) {
      isAvailable = Boolean(inventory.available) && inventory.stockQuantity > 0;
      availableStock = inventory.stockQuantity;
    } else {
      // Missing inventory record for this branch means strictly NOT AVAILABLE
      isAvailable = false;
      availableStock = 0;
    }

    return res.status(200).json({
      success: true,
      available: isAvailable,
      branch: {
        id: branch._id,
        _id: branch._id,
        name: branch.name,
        branchCode: branch.branchCode
      },
      product: {
        id: product._id,
        _id: product._id,
        name: product.name,
        barcode: product.barcode,
        price: product.price,
        stock: availableStock,
        stockQuantity: availableStock,
        image: product.image
      },
      message: isAvailable
        ? `✓ Available at ${branch.name}`
        : `This product is currently unavailable at ${branch.name}.`
    });
  } catch (error) {
    console.error('[BranchRoutes] Error checking availability:', error);
    return res.status(500).json({
      success: false,
      available: false,
      message: 'Failed to verify branch availability',
      error: error.message
    });
  }
});

// GET /api/v1/branches/:id
router.get('/:id', (req, res) => {
  const branch =
    defaultBranches.find((b) => b._id === req.params.id || b.branchCode === req.params.id) ||
    defaultBranches[0];
  return successResponse(res, 'Branch details fetched successfully', branch);
});

module.exports = router;
