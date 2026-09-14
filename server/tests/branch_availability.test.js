require('dotenv').config();
const request = require('supertest');
const app = require('../app');
const { connectDB, disconnectDB } = require('../config/db');
const Product = require('../models/Product');
const Cart = require('../models/Cart');
const BranchAvailability = require('../models/BranchAvailability');
const { initBranchAvailability } = require('../services/branchAvailabilityService');

jest.setTimeout(30000);

describe('SmartScan Pay — Supermarket Branches & Product Availability Flow', () => {
  let customerToken = null;
  let customerId = null;

  beforeAll(async () => {
    await connectDB();
    await initBranchAvailability();

    // Register a test customer
    const phone = `+9196${Math.floor(10000000 + Math.random() * 90000000)}`;
    const regRes = await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'Branch Tester',
        phone,
        email: `branch_tester_${Date.now()}@smartscanpay.local`,
        password: 'Password123!'
      });

    customerToken = regRes.body.token || regRes.body.data?.token;
    customerId = regRes.body.user?.id || regRes.body.user?._id || regRes.body.data?.user?.id;
  });

  afterAll(async () => {
    await disconnectDB();
  });

  // TEST 1: Branches listing
  it('TEST 1: GET /api/v1/branches should return D Mart branches', async () => {
    const res = await request(app).get('/api/v1/branches');
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);

    const branchIds = res.body.data.map((b) => b._id);
    expect(branchIds).toContain('dmart-kukatpally');
    expect(branchIds).toContain('dmart-miyapur');
    expect(branchIds).toContain('dmart-madhapur');
  });

  // TEST 2: Nearby branches with distance calculation
  it('TEST 2: GET /api/v1/branches/nearby should compute distance and sort nearest first', async () => {
    // Coordinate close to Kukatpally (17.48, 78.41)
    const res = await request(app)
      .get('/api/v1/branches/nearby')
      .query({ lat: 17.4849, lng: 78.4138 });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);

    const nearest = res.body.data[0];
    expect(nearest._id).toBe('dmart-kukatpally');
    expect(nearest.distanceKm).toBeDefined();
    expect(nearest.distanceText).toBeDefined();
  });

  // TEST 3: Available product check at selected branch
  it('TEST 3: GET /api/v1/branches/:branchId/availability/:barcode should return available: true for Marie Gold at Kukatpally', async () => {
    const res = await request(app).get('/api/v1/branches/dmart-kukatpally/availability/8901063371040');
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.available).toBe(true);
    expect(res.body.product.name).toContain('Marie Gold');
    expect(res.body.branch.name).toBe('D Mart Kukatpally');
    expect(res.body.message).toContain('Available');
  });

  // TEST 4: Unavailable product check at selected branch
  it('TEST 4: GET /api/v1/branches/:branchId/availability/:barcode should return available: false for Parle-G at Kukatpally', async () => {
    const res = await request(app).get('/api/v1/branches/dmart-kukatpally/availability/8901719101032');
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.available).toBe(false);
    expect(res.body.product.name).toContain('Parle-G');
    expect(res.body.message).toContain('unavailable at D Mart Kukatpally');
  });

  // TEST 5: Backward compatibility: getProductByBarcode with branchId
  it('TEST 5: GET /api/v1/products/barcode/:barcode?branchId=... should return product + branchAvailability', async () => {
    const res = await request(app)
      .get('/api/v1/products/barcode/8901063371040')
      .query({ branchId: 'dmart-kukatpally' });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.product.name).toContain('Marie Gold');
    expect(res.body.branchAvailability).toBeDefined();
    expect(res.body.branchAvailability.available).toBe(true);
    expect(res.body.branchAvailability.branchName).toBe('D Mart Kukatpally');
  });

  // TEST 6: Adding available product to cart succeeds and remembers branch
  it('TEST 6: POST /api/v1/cart/items with available product succeeds and associates branch with cart', async () => {
    const res = await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        barcode: '8901063371040',
        quantity: 1,
        branchId: 'dmart-kukatpally'
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.cart.branchId).toBe('dmart-kukatpally');
    expect(res.body.cart.branchName).toBe('D Mart Kukatpally');
    expect(res.body.cart.items.length).toBe(1);
    expect(res.body.cart.items[0].barcode).toBe('8901063371040');
  });

  // TEST 7: Adding unavailable product to cart is blocked by backend
  it('TEST 7: POST /api/v1/cart/items with unavailable product fails with 400 and does NOT add to cart', async () => {
    const res = await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        barcode: '8901719101032', // Parle-G is unavailable at Kukatpally
        quantity: 1,
        branchId: 'dmart-kukatpally'
      });

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.available).toBe(false);
    expect(res.body.message).toContain('unavailable at D Mart Kukatpally');

    // Verify cart still only has the 1 previous item
    const cartRes = await request(app)
      .get('/api/v1/cart')
      .set('Authorization', `Bearer ${customerToken}`);

    expect(cartRes.body.cart.items.length).toBe(1);
    expect(cartRes.body.cart.items[0].barcode).toBe('8901063371040');
  });
});
