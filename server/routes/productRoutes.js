const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const { authenticate } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

/**
 * Customer Barcode Lookup
 * GET /api/products/barcode/:barcode
 * GET /api/products/scan/:barcode (alias for backward compatibility)
 */
router.get('/barcode/:barcode', productController.getProductByBarcode);
router.get('/scan/:barcode', productController.getProductByBarcode);

/**
 * Branch-Aware Product Search
 * GET /api/products/search?q=...&branchId=...
 */
router.get('/search', productController.searchProducts);

/**
 * Product Management (Admin & Search)
 */
router.get('/', productController.listProducts);
router.post('/', authenticate, authorize('admin'), productController.createProduct);
router.put('/:id', authenticate, authorize('admin'), productController.updateProduct);
router.delete('/:id', authenticate, authorize('admin'), productController.deleteProduct);

module.exports = router;
