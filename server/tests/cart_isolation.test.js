require('dotenv').config();
const request = require('supertest');
const app = require('../app');
const { connectDB, disconnectDB } = require('../config/db');
const Product = require('../models/Product');
const Cart = require('../models/Cart');
const Transaction = require('../models/Transaction');

jest.setTimeout(30000);

describe('SmartScan Pay — User-Specific Cart and Data Isolation', () => {
  let customerAToken = null;
  let customerAId = null;
  let customerBToken = null;
  let customerBId = null;
  let adminToken = null;
  let adminId = null;

  let marieGoldProduct = null;
  let jimJamProduct = null;

  beforeAll(async () => {
    await connectDB();

    // 1. Setup Customer A
    const phoneA = `+9191${Math.floor(10000000 + Math.random() * 90000000)}`;
    const regA = await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'Customer Alice',
        phone: phoneA,
        email: `alice_${Date.now()}@smartscanpay.local`,
        password: 'Password123!'
      });
    expect(regA.statusCode).toBe(201);
    customerAToken = regA.body.data.token;
    customerAId = regA.body.data.user._id;

    // 2. Setup Customer B
    const phoneB = `+9192${Math.floor(10000000 + Math.random() * 90000000)}`;
    const regB = await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'Customer Bob',
        phone: phoneB,
        email: `bob_${Date.now()}@smartscanpay.local`,
        password: 'Password123!'
      });
    expect(regB.statusCode).toBe(201);
    customerBToken = regB.body.data.token;
    customerBId = regB.body.data.user._id;

    // 3. Setup Admin
    const phoneAdmin = `+9193${Math.floor(10000000 + Math.random() * 90000000)}`;
    const regAdmin = await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'Admin User',
        phone: phoneAdmin,
        email: `admin_${Date.now()}@smartscanpay.local`,
        password: 'Password123!'
      });
    expect(regAdmin.statusCode).toBe(201);
    adminToken = regAdmin.body.data.token;
    adminId = regAdmin.body.data.user._id;

    // Elevate admin role in User document
    const User = require('../models/User');
    await User.findByIdAndUpdate(adminId, { role: 'admin' });

    // 4. Products
    marieGoldProduct = await Product.findOne({ barcode: '8901063371040' });
    expect(marieGoldProduct).toBeDefined();

    jimJamProduct = await Product.findOne({ barcode: '8901063029255' });
    if (!jimJamProduct) {
      jimJamProduct = await Product.create({
        name: 'Britannia Jim Jam Biscuits',
        barcode: '8901063029255',
        price: 10,
        stock: 50
      });
    }
  });

  afterAll(async () => {
    await disconnectDB();
  });

  // TEST 1: Customer A adds Marie Gold
  it('TEST 1: Customer A adds Marie Gold to cart -> cart has 1 item (₹5)', async () => {
    const addRes = await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${customerAToken}`)
      .send({
        barcode: '8901063371040',
        quantity: 1
      });

    expect(addRes.statusCode).toBe(200);
    expect(addRes.body.success).toBe(true);
    expect(addRes.body.data.itemCount).toBe(1);
    expect(addRes.body.data.totalAmount).toBe(5);
    expect(addRes.body.data.items[0].barcode).toBe('8901063371040');

    // Verify in MongoDB: Cart belongs to Customer A
    const cartInDb = await Cart.findOne({ user: customerAId });
    expect(cartInDb).toBeDefined();
    expect(cartInDb.items.length).toBe(1);
    expect(cartInDb.items[0].name).toContain('Marie Gold');
  });

  // TEST 2: Admin checks cart -> Admin cart MUST BE EMPTY
  it('TEST 2: Admin requests cart -> Admin cart is EMPTY (Customer A item never leaks)', async () => {
    const adminCartRes = await request(app)
      .get('/api/v1/cart')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(adminCartRes.statusCode).toBe(200);
    expect(adminCartRes.body.success).toBe(true);
    expect(adminCartRes.body.data.itemCount).toBe(0);
    expect(adminCartRes.body.data.totalAmount).toBe(0);
    expect(adminCartRes.body.data.items.length).toBe(0);
  });

  // TEST 3: Admin adds Jim Jam (₹10) -> Admin cart has ONLY Jim Jam
  it('TEST 3: Admin adds a different product -> Admin cart contains ONLY Admin product, Customer A cart is untouched', async () => {
    const addAdminRes = await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        barcode: '8901063029255',
        quantity: 2
      });

    expect(addAdminRes.statusCode).toBe(200);
    expect(addAdminRes.body.data.itemCount).toBe(2);
    expect(addAdminRes.body.data.totalAmount).toBe(20);
    expect(addAdminRes.body.data.items.length).toBe(1);
    expect(addAdminRes.body.data.items[0].barcode).toBe('8901063029255');

    // Customer A cart must still contain ONLY Marie Gold × 1 (₹5)
    const cartARes = await request(app)
      .get('/api/v1/cart')
      .set('Authorization', `Bearer ${customerAToken}`);

    expect(cartARes.statusCode).toBe(200);
    expect(cartARes.body.data.itemCount).toBe(1);
    expect(cartARes.body.data.totalAmount).toBe(5);
    expect(cartARes.body.data.items[0].barcode).toBe('8901063371040');
  });

  // TEST 4: Customer B checks cart -> Customer B cart is EMPTY
  it('TEST 4: Customer B requests cart -> Customer B sees EMPTY cart', async () => {
    const cartBRes = await request(app)
      .get('/api/v1/cart')
      .set('Authorization', `Bearer ${customerBToken}`);

    expect(cartBRes.statusCode).toBe(200);
    expect(cartBRes.body.data.itemCount).toBe(0);
    expect(cartBRes.body.data.totalAmount).toBe(0);
  });

  // TEST 5: Order Isolation
  it('TEST 5: Order created by Customer A cannot be accessed by Customer B', async () => {
    // Customer A checkouts
    const checkoutRes = await request(app)
      .post('/api/v1/transactions/checkout')
      .set('Authorization', `Bearer ${customerAToken}`)
      .send({});

    expect(checkoutRes.statusCode).toBe(201);
    const orderId = checkoutRes.body.order._id;

    // Customer A can view their order
    const getResA = await request(app)
      .get(`/api/v1/orders/${orderId}`)
      .set('Authorization', `Bearer ${customerAToken}`);

    expect(getResA.statusCode).toBe(200);

    // Customer B trying to view Customer A's order -> 403 Forbidden
    const getResB = await request(app)
      .get(`/api/v1/orders/${orderId}`)
      .set('Authorization', `Bearer ${customerBToken}`);

    expect(getResB.statusCode).toBe(403);
    expect(getResB.body.success).toBe(false);
  });
});
