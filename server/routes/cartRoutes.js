const express = require('express');
const router = express.Router();
const cartController = require('../controllers/cartController');
const { authenticate } = require('../middleware/authMiddleware');

// All cart operations strictly require authentication and use req.user._id
router.use(authenticate);

// Get authenticated user's cart
router.get('/', cartController.getCart);

// Add item to cart
router.post('/', cartController.addToCart);
router.post('/items', cartController.addToCart);

// Update item quantity in cart
router.put('/items/:itemId', cartController.updateCartItem);
router.patch('/items/:itemId', cartController.updateCartItem);
router.put('/:itemId', cartController.updateCartItem);
router.patch('/:itemId', cartController.updateCartItem);

// Remove item from cart
router.delete('/items/:itemId', cartController.removeFromCart);
router.delete('/:itemId', cartController.removeFromCart);

// Clear entire cart
router.delete('/', cartController.clearCart);

module.exports = router;
