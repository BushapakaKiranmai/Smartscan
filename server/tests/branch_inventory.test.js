require('dotenv').config();
const request = require('supertest');
const app = require('../app');
const { connectDB, disconnectDB } = require('../config/db');
const Product = require('../models/Product');
const BranchInventory = require('../models/BranchInventory');
const Cart = require('../models/Cart');
const { initBranchAvailability } = require('../services/branchAvailabilityService');

jest.setTimeout(35000);

describe('SmartScan Pay — Branch-Wise Product Availability & Inventory Architecture', () => {
  let customerToken = null;
  let customerId = null;
  let marieGoldProduct = null;
  let parleGProduct = null;

  beforeAll(async () => {
    await connectDB();
    await initBranchAvailability();

    // Find the products
    marieGoldProduct = await Product.findOne({ barcode: '8901063371040' });
    parleGProduct = await Product.findOne({ barcode: '8901719101032' });

    // Register a test customer
    const phone = `+9197${Math.floor(10000000 + Math.random() * 90000000)}`;
    const regRes = await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'Inventory Tester',
        phone,
        email: `inv_tester_${Date.now()}@smartscanpay.local`,
        password: 'Password123!'
      });

    customerToken = regRes.body.token || regRes.body.data?.token;
    customerId = regRes.body.user?.id || regRes.body.user?._id || regRes.body.data?.user?.id;
  });

  afterAll(async () => {
    await disconnectDB();
  });

  // =========================================================================
  // 1. SINGLE PRODUCT ENTITY TEST
  // =========================================================================
  it('TEST 1: Product Britannia Marie Gold is stored ONLY ONCE in the main Product collection', async () => {
    const products = await Product.find({ barcode: '8901063371040' });
    expect(products.length).toBe(1);
    expect(products[0].name).toContain('Marie Gold');
    expect(products[0].price).toBe(5);
  });

  // =========================================================================
  // 2. INDEPENDENT BRANCH INVENTORY RECORDS
  // =========================================================================
  it('TEST 2: Separate BranchInventory records exist for Kukatpally (48), Miyapur (0), and Madhapur (25)', async () => {
    expect(marieGoldProduct).toBeDefined();

    const kukatpallyInv = await BranchInventory.findOne({
      branchId: 'dmart-kukatpally',
      productId: marieGoldProduct._id
    });
    const miyapurInv = await BranchInventory.findOne({
      branchId: 'dmart-miyapur',
      productId: marieGoldProduct._id
    });
    const madhapurInv = await BranchInventory.findOne({
      branchId: 'dmart-madhapur',
      productId: marieGoldProduct._id
    });

    expect(kukatpallyInv).not.toBeNull();
    expect(kukatpallyInv.stockQuantity).toBe(48);
    expect(kukatpallyInv.available).toBe(true);

    expect(miyapurInv).not.toBeNull();
    expect(miyapurInv.stockQuantity).toBe(0);
    expect(miyapurInv.available).toBe(false);

    expect(madhapurInv).not.toBeNull();
    expect(madhapurInv.stockQuantity).toBe(25);
    expect(madhapurInv.available).toBe(true);
  });

  // =========================================================================
  // 3. ZERO STOCK HOOK & CONSTRAINTS
  // =========================================================================
  it('TEST 3: Setting stockQuantity to 0 automatically marks available = false', async () => {
    const testInv = new BranchInventory({
      branchId: 'test-branch',
      productId: marieGoldProduct._id,
      stockQuantity: 0,
      available: true
    });

    await testInv.save();
    expect(testInv.available).toBe(false);

    // Clean up
    await BranchInventory.deleteOne({ _id: testInv._id });
  });

  // =========================================================================
  // 4. BRANCH-AWARE PRODUCT SEARCH (GET /api/v1/products/search)
  // =========================================================================
  it('TEST 4: Search Marie Gold at Kukatpally returns Available with 48 in stock', async () => {
    const res = await request(app)
      .get('/api/v1/products/search')
      .query({ q: 'Marie Gold', branchId: 'dmart-kukatpally' });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.products)).toBe(true);

    const match = res.body.products.find((p) => p.barcode === '8901063371040');
    expect(match).toBeDefined();
    expect(match.available).toBe(true);
    expect(match.stockQuantity).toBe(48);
    expect(match.price).toBe(5);
    expect(match.branchAvailability.message).toContain('Available at D Mart Kukatpally');
  });

  it('TEST 5: Search Marie Gold at Miyapur returns Unavailable with 0 stock', async () => {
    const res = await request(app)
      .get('/api/v1/products/search')
      .query({ q: 'Marie Gold', branchId: 'dmart-miyapur' });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);

    const match = res.body.products.find((p) => p.barcode === '8901063371040');
    expect(match).toBeDefined();
    expect(match.available).toBe(false);
    expect(match.stockQuantity).toBe(0);
    expect(match.branchAvailability.message).toContain('unavailable at D Mart Miyapur');
  });

  it('TEST 6: Search Marie Gold at Madhapur returns Available with 25 in stock', async () => {
    const res = await request(app)
      .get('/api/v1/products/search')
      .query({ q: 'Marie Gold', branchId: 'dmart-madhapur' });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);

    const match = res.body.products.find((p) => p.barcode === '8901063371040');
    expect(match).toBeDefined();
    expect(match.available).toBe(true);
    expect(match.stockQuantity).toBe(25);
  });

  it('TEST 7: Product without BranchInventory record for selected branch is treated as NOT AVAILABLE', async () => {
    // Parle-G was omitted from Miyapur in initBranchAvailability
    const res = await request(app)
      .get('/api/v1/products/search')
      .query({ q: 'Parle-G', branchId: 'dmart-miyapur' });

    expect(res.statusCode).toBe(200);
    const match = res.body.products.find((p) => p.barcode === '8901719101032');
    expect(match).toBeDefined();
    expect(match.available).toBe(false);
    expect(match.stockQuantity).toBe(0);
  });

  // =========================================================================
  // 5. BARCODE LOOKUP WITH BRANCH INVENTORY
  // =========================================================================
  it('TEST 8: Barcode scan at Kukatpally returns available: true, stock: 48', async () => {
    const res = await request(app)
      .get('/api/v1/products/barcode/8901063371040')
      .query({ branchId: 'dmart-kukatpally' });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.product.available).toBe(true);
    expect(res.body.product.stockQuantity).toBe(48);
  });

  it('TEST 9: Barcode scan at Miyapur returns available: false, stock: 0', async () => {
    const res = await request(app)
      .get('/api/v1/products/barcode/8901063371040')
      .query({ branchId: 'dmart-miyapur' });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.product.available).toBe(false);
    expect(res.body.product.stockQuantity).toBe(0);
  });

  // =========================================================================
  // 6. CART VERIFICATION & ENFORCEMENT
  // =========================================================================
  it('TEST 10: Adding Marie Gold to cart at Kukatpally succeeds', async () => {
    const res = await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        productId: marieGoldProduct._id,
        barcode: '8901063371040',
        quantity: 1,
        branchId: 'dmart-kukatpally'
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.cart.items.length).toBeGreaterThan(0);
    const item = res.body.cart.items.find((i) => i.barcode === '8901063371040');
    expect(item).toBeDefined();
    expect(item.quantity).toBe(1);
    expect(item.price).toBe(5);
  });

  it('TEST 11: Adding Marie Gold to cart at Miyapur fails with 400 (unavailable)', async () => {
    const res = await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        productId: marieGoldProduct._id,
        barcode: '8901063371040',
        quantity: 1,
        branchId: 'dmart-miyapur'
      });

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.available).toBe(false);
    expect(res.body.message).toContain('unavailable at D Mart Miyapur');
  });

  it('TEST 12: Adding more than available branch stock fails with 400', async () => {
    const res = await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        productId: marieGoldProduct._id,
        barcode: '8901063371040',
        quantity: 999,
        branchId: 'dmart-kukatpally'
      });

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('available');
  });

  // =========================================================================
  // 7. ADMIN BRANCH INVENTORY MANAGEMENT
  // =========================================================================
  it('TEST 13: Admin can update branch inventory via PUT /api/v1/branches/:branchId/inventory/:productId', async () => {
    // Update Madhapur stock from 25 to 35
    const updateRes = await request(app)
      .put(`/api/v1/branches/dmart-madhapur/inventory/${marieGoldProduct._id}`)
      .send({
        stockQuantity: 35,
        available: true
      });

    expect(updateRes.statusCode).toBe(200);
    expect(updateRes.body.success).toBe(true);
    expect(updateRes.body.data.stockQuantity).toBe(35);

    // Verify search reflects updated stock
    const searchRes = await request(app)
      .get('/api/v1/products/search')
      .query({ q: 'Marie Gold', branchId: 'dmart-madhapur' });

    const match = searchRes.body.products.find((p) => p.barcode === '8901063371040');
    expect(match.stockQuantity).toBe(35);

    // Restore to 25
    await request(app)
      .put(`/api/v1/branches/dmart-madhapur/inventory/${marieGoldProduct._id}`)
      .send({ stockQuantity: 25, available: true });
  });

  it('TEST 14: GET /api/v1/branches/:branchId/inventory lists inventory populated with product details', async () => {
    const res = await request(app).get('/api/v1/branches/dmart-kukatpally/inventory');
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);

    const marieRecord = res.body.data.find(
      (inv) => inv.product?.barcode === '8901063371040'
    );
    expect(marieRecord).toBeDefined();
    expect(marieRecord.stockQuantity).toBe(48);
    expect(marieRecord.product.name).toContain('Marie Gold');
  });
});
