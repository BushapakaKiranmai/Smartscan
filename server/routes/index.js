const express = require('express');
const router = express.Router();

const authRoutes = require('./authRoutes');
const productRoutes = require('./productRoutes');
const cartRoutes = require('./cartRoutes');
const transactionRoutes = require('./transactionRoutes');
const { supermarketRouter } = require('./supermarketRoutes');
const branchRoutes = require('./branchRoutes');
const exitRoutes = require('./exitRoutes');

// Primary Routes
router.use('/auth', authRoutes);
router.use('/products', productRoutes);
router.use('/cart', cartRoutes);
router.use('/transactions', transactionRoutes);

// Supermarket & Store Location Routes
router.use('/supermarkets', supermarketRouter);
router.use('/branches', branchRoutes);

// Exit Pass & Two-Layer Verification
router.use('/exit', exitRoutes);
router.use('/exit-passes', exitRoutes);

// Compatibility aliases for existing client flows
router.use('/orders', transactionRoutes);
router.use('/payments', transactionRoutes);

module.exports = router;
