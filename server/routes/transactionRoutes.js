const express = require('express');
const router = express.Router();
const transactionController = require('../controllers/transactionController');
const { authenticate } = require('../middleware/authMiddleware');

/**
 * Checkout / Create Transaction
 * POST /api/transactions
 * POST /api/transactions/checkout
 */
router.post('/', authenticate, transactionController.createTransaction);
router.post('/checkout', authenticate, transactionController.createTransaction);
router.post('/create-order', authenticate, transactionController.createPaymentOrder);

/**
 * Payment Verification & Stock Update
 * POST /api/transactions/:id/verify
 * POST /api/transactions/verify
 * POST /api/transactions/simulate-upi
 */
router.post('/verify', authenticate, transactionController.verifyPayment);
router.post('/:id/verify', authenticate, transactionController.verifyPayment);
router.post('/simulate-upi', authenticate, transactionController.simulateInboundUpiPayment);
router.post('/:id/simulate-upi', authenticate, transactionController.simulateInboundUpiPayment);

/**
 * Customer Transaction History
 * GET /api/transactions/my
 */
router.get('/my', authenticate, transactionController.getMyTransactions);

/**
 * Single Transaction Receipt & Exit Token
 * GET /api/transactions/:id
 * GET /api/transactions/token/:id
 */
router.get('/:id', authenticate, transactionController.getTransactionById);
router.get('/token/:id', authenticate, transactionController.getTransactionById);

/**
 * Admin: List all transactions and sales metrics
 * GET /api/transactions
 */
router.get('/', authenticate, transactionController.getAllTransactions);

module.exports = router;
