require('dotenv').config();
const request = require('supertest');
const app = require('../app');
const { connectDB, disconnectDB } = require('../config/db');
const Product = require('../models/Product');
const BranchInventory = require('../models/BranchInventory');
const Transaction = require('../models/Transaction');
const { initBranchAvailability } = require('../services/branchAvailabilityService');

jest.setTimeout(35000);

describe('SmartScan Pay — Product Availability & Post-Purchase Inventory Flow', () => {
  let customerToken = null;
  let customerId = null;
  let marieGoldProduct = null;

  beforeAll(async () => {
    await connectDB();
    await initBranchAvailability();

    marieGoldProduct = await Product.findOne({ barcode: '8901063371040' });
    expect(marieGoldProduct).toBeDefined();

    // Register a fresh test customer
    const phone = `+9196${Math.floor(10000000 + Math.random() * 90000000)}`;
    const regRes = await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'Purchase Flow Tester',
        phone,
        email: `purchase_flow_${Date.now()}@smartscanpay.local`,
        password: 'Password123!'
      });

    customerToken = regRes.body.token || regRes.body.data?.token;
    customerId = regRes.body.user?.id || regRes.body.user?._id || regRes.body.data?.user?.id;
  });

  afterAll(async () => {
    // Reset Marie Gold branch inventory back to 48
    if (marieGoldProduct) {
      await BranchInventory.findOneAndUpdate(
        { branchId: 'dmart-kukatpally', productId: marieGoldProduct._id },
        { stockQuantity: 48, available: true }
      );
    }
    await disconnectDB();
  });

  // =========================================================================
  // TEST 1: Initial State (Marie Gold stock = 48 at Kukatpally)
  // =========================================================================
  it('TEST 1: Initial branch stock for Marie Gold at D Mart Kukatpally is 48 and Available', async () => {
    await BranchInventory.findOneAndUpdate(
      { branchId: 'dmart-kukatpally', productId: marieGoldProduct._id },
      { stockQuantity: 48, available: true }
    );

    const searchRes = await request(app)
      .get('/api/v1/products/search')
      .query({ q: 'Marie Gold', branchId: 'dmart-kukatpally' });

    expect(searchRes.statusCode).toBe(200);
    const found = (searchRes.body.products || searchRes.body.data || []).find(
      p => p.barcode === '8901063371040'
    );
    expect(found).toBeDefined();
    expect(found.available).toBe(true);
    expect(found.stockQuantity).toBe(48);
  });

  // =========================================================================
  // TEST 2: Stock Unchanged During Cart & Checkout Initiation
  // =========================================================================
  it('TEST 2: Creating order does NOT deduct stock before payment is verified', async () => {
    const checkoutRes = await request(app)
      .post('/api/v1/transactions/checkout')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        branchId: 'dmart-kukatpally',
        items: [
          {
            productId: marieGoldProduct._id,
            barcode: '8901063371040',
            name: marieGoldProduct.name,
            price: marieGoldProduct.price,
            quantity: 1
          }
        ]
      });

    expect([200, 201]).toContain(checkoutRes.statusCode);
    const orderId = checkoutRes.body.order?._id || checkoutRes.body.transaction?._id;
    expect(orderId).toBeDefined();

    // Check branch inventory: MUST STILL BE 48!
    const inv = await BranchInventory.findOne({
      branchId: 'dmart-kukatpally',
      productId: marieGoldProduct._id
    });
    expect(inv.stockQuantity).toBe(48);
  });

  // =========================================================================
  // TEST 3: Post-Payment Stock Deduction (48 -> 47) & Product Master Intact
  // =========================================================================
  it('TEST 3: After verified payment of ₹5, branch stock becomes 47 and Product master is NOT deleted', async () => {
    // 1. Create checkout order
    const checkoutRes = await request(app)
      .post('/api/v1/transactions/checkout')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        branchId: 'dmart-kukatpally',
        items: [
          {
            productId: marieGoldProduct._id,
            barcode: '8901063371040',
            name: marieGoldProduct.name,
            price: 5,
            quantity: 1
          }
        ]
      });

    expect([200, 201]).toContain(checkoutRes.statusCode);
    const orderId = checkoutRes.body.order?._id || checkoutRes.body.transaction?._id;

    // 2. Inbound payment reports exact 500 paise (₹5)
    await request(app)
      .post('/api/v1/payments/simulate-upi')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        orderId,
        amountPaise: 500,
        status: 'captured'
      });

    // 3. Verify payment
    const verifyRes = await request(app)
      .post('/api/v1/payments/verify')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ orderId });

    expect(verifyRes.statusCode).toBe(200);
    expect(verifyRes.body.paymentStatus).toBe('PAYMENT_SUCCESS');

    // 4. Verify branch inventory: Stock must be 47, available must be true!
    const inv = await BranchInventory.findOne({
      branchId: 'dmart-kukatpally',
      productId: marieGoldProduct._id
    });
    expect(inv.stockQuantity).toBe(47);
    expect(inv.available).toBe(true);

    // 5. CRITICAL (Section 9 & 25): Verify Product document in main Product collection is NOT deleted!
    const productStillExists = await Product.findOne({ barcode: '8901063371040' });
    expect(productStillExists).not.toBeNull();
    expect(productStillExists._id.toString()).toBe(marieGoldProduct._id.toString());
    expect(productStillExists.name).toContain('Marie Gold');

    // 6. Search API check: Searching Marie Gold returns 47 available
    const searchRes = await request(app)
      .get('/api/v1/products/search')
      .query({ q: 'Marie Gold', branchId: 'dmart-kukatpally' });

    expect(searchRes.statusCode).toBe(200);
    const found = (searchRes.body.products || searchRes.body.data || []).find(
      p => p.barcode === '8901063371040'
    );
    expect(found).toBeDefined();
    expect(found.available).toBe(true);
    expect(found.stockQuantity).toBe(47);
  });

  // =========================================================================
  // TEST 4: Stock Reaching Zero (1 -> 0) Marks Available = False
  // =========================================================================
  it('TEST 4: When stock reaches 0 after purchase, available becomes false and product search shows Not Available', async () => {
    // Set branch stock to 1
    await BranchInventory.findOneAndUpdate(
      { branchId: 'dmart-kukatpally', productId: marieGoldProduct._id },
      { stockQuantity: 1, available: true }
    );

    // Customer purchases 1
    const checkoutRes = await request(app)
      .post('/api/v1/transactions/checkout')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        branchId: 'dmart-kukatpally',
        items: [
          {
            productId: marieGoldProduct._id,
            barcode: '8901063371040',
            name: marieGoldProduct.name,
            price: 5,
            quantity: 1
          }
        ]
      });

    expect([200, 201]).toContain(checkoutRes.statusCode);
    const orderId = checkoutRes.body.order?._id || checkoutRes.body.transaction?._id;

    // Inbound payment reports exact 500 paise
    await request(app)
      .post('/api/v1/payments/simulate-upi')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        orderId,
        amountPaise: 500,
        status: 'captured'
      });

    // Verify payment
    const verifyRes = await request(app)
      .post('/api/v1/payments/verify')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ orderId });

    expect(verifyRes.statusCode).toBe(200);
    expect(verifyRes.body.paymentStatus).toBe('PAYMENT_SUCCESS');

    // Branch inventory must now be stock = 0, available = false
    const inv = await BranchInventory.findOne({
      branchId: 'dmart-kukatpally',
      productId: marieGoldProduct._id
    });
    expect(inv.stockQuantity).toBe(0);
    expect(inv.available).toBe(false);

    // CRITICAL: Master Product document MUST STILL EXIST in the Product collection!
    const productStillExists = await Product.findOne({ barcode: '8901063371040' });
    expect(productStillExists).not.toBeNull();

    // Search API check: Searching Marie Gold returns available = false, stockQuantity = 0
    const searchRes = await request(app)
      .get('/api/v1/products/search')
      .query({ q: 'Marie Gold', branchId: 'dmart-kukatpally' });

    expect(searchRes.statusCode).toBe(200);
    const found = (searchRes.body.products || searchRes.body.data || []).find(
      p => p.barcode === '8901063371040'
    );
    expect(found).toBeDefined();
    expect(found.available).toBe(false);
    expect(found.stockQuantity).toBe(0);
  });

  // =========================================================================
  // TEST 5: Prevent Selling More Than Available Branch Stock
  // =========================================================================
  it('TEST 5: Prevents purchasing more quantity than branch stock and rejects with 400', async () => {
    // Set branch stock to 2
    await BranchInventory.findOneAndUpdate(
      { branchId: 'dmart-kukatpally', productId: marieGoldProduct._id },
      { stockQuantity: 2, available: true }
    );

    // Customer tries to buy 3
    const checkoutRes = await request(app)
      .post('/api/v1/transactions/checkout')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        branchId: 'dmart-kukatpally',
        items: [
          {
            productId: marieGoldProduct._id,
            barcode: '8901063371040',
            name: marieGoldProduct.name,
            price: 5,
            quantity: 3
          }
        ]
      });

    expect(checkoutRes.statusCode).toBe(400);
    expect(checkoutRes.body.message).toContain('Only 2 items are available');
  });

  // =========================================================================
  // TEST 6: Branch Isolation - Other Branches Inventory Unaffected
  // =========================================================================
  it('TEST 6: Purchasing at Kukatpally does NOT change inventory at Madhapur', async () => {
    // Madhapur initial stock = 25
    const madhapurBefore = await BranchInventory.findOne({
      branchId: 'dmart-madhapur',
      productId: marieGoldProduct._id
    });
    const initialMadhapurStock = madhapurBefore ? madhapurBefore.stockQuantity : 25;

    // Reset Kukatpally to 48 and purchase 2 at Kukatpally (2 x ₹5 = ₹10 = 1000 paise)
    await BranchInventory.findOneAndUpdate(
      { branchId: 'dmart-kukatpally', productId: marieGoldProduct._id },
      { stockQuantity: 48, available: true }
    );

    const checkoutRes = await request(app)
      .post('/api/v1/transactions/checkout')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        branchId: 'dmart-kukatpally',
        items: [
          {
            productId: marieGoldProduct._id,
            barcode: '8901063371040',
            name: marieGoldProduct.name,
            price: 5,
            quantity: 2
          }
        ]
      });

    const orderId = checkoutRes.body.order?._id || checkoutRes.body.transaction?._id;

    // Inbound payment of 1000 paise
    await request(app)
      .post('/api/v1/payments/simulate-upi')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        orderId,
        amountPaise: 1000,
        status: 'captured'
      });

    const verifyRes = await request(app)
      .post('/api/v1/payments/verify')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ orderId });

    expect(verifyRes.statusCode).toBe(200);

    // Kukatpally stock should be 46
    const kukatpallyAfter = await BranchInventory.findOne({
      branchId: 'dmart-kukatpally',
      productId: marieGoldProduct._id
    });
    expect(kukatpallyAfter.stockQuantity).toBe(46);

    // Madhapur stock MUST REMAIN UNTOUCHED!
    const madhapurAfter = await BranchInventory.findOne({
      branchId: 'dmart-madhapur',
      productId: marieGoldProduct._id
    });
    expect(madhapurAfter.stockQuantity).toBe(initialMadhapurStock);
  });
});
