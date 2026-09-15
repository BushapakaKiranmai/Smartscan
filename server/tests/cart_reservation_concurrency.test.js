require('dotenv').config();
const request = require('supertest');
const app = require('../app');
const { connectDB, disconnectDB } = require('../config/db');
const Product = require('../models/Product');
const BranchInventory = require('../models/BranchInventory');
const Cart = require('../models/Cart');
const Reservation = require('../models/Reservation');
const Transaction = require('../models/Transaction');
const ExitPass = require('../models/ExitPass');

jest.setTimeout(40000);

describe('SmartScan Pay — Cart Single-Item & Concurrency-Safe Inventory Reservation Suite', () => {
  let customerAToken = null;
  let customerAId = null;
  let customerBToken = null;
  let customerBId = null;

  let marieGoldProduct = null;
  let jimJamProduct = null;
  let parleGProduct = null;

  beforeAll(async () => {
    await connectDB();

    // 1. Setup Customer A
    const phoneA = `+9198${Math.floor(10000000 + Math.random() * 90000000)}`;
    const regA = await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'Customer A',
        phone: phoneA,
        email: `customera_${Date.now()}@smartscanpay.local`,
        password: 'Password123!'
      });
    expect(regA.statusCode).toBe(201);
    customerAToken = regA.body.token || regA.body.data?.token;
    customerAId = regA.body.user?._id || regA.body.data?.user?._id;

    // 2. Setup Customer B
    const phoneB = `+9199${Math.floor(10000000 + Math.random() * 90000000)}`;
    const regB = await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'Customer B',
        phone: phoneB,
        email: `customerb_${Date.now()}@smartscanpay.local`,
        password: 'Password123!'
      });
    expect(regB.statusCode).toBe(201);
    customerBToken = regB.body.token || regB.body.data?.token;
    customerBId = regB.body.user?._id || regB.body.data?.user?._id;

    // 3. Resolve products
    marieGoldProduct = await Product.findOne({ barcode: '8901063371040' });
    if (!marieGoldProduct) {
      marieGoldProduct = await Product.create({
        name: 'Britannia Marie Gold Biscuits',
        barcode: '8901063371040',
        price: 5,
        stock: 50
      });
    }

    jimJamProduct = await Product.findOne({ barcode: '8901063029255' });
    if (!jimJamProduct) {
      jimJamProduct = await Product.create({
        name: 'Britannia Jim Jam Biscuits',
        barcode: '8901063029255',
        price: 10,
        stock: 50
      });
    }

    parleGProduct = await Product.findOne({ barcode: '8901719101032' });
    if (!parleGProduct) {
      parleGProduct = await Product.create({
        name: 'Parle-G Glucose Biscuits',
        barcode: '8901719101032',
        price: 5,
        stock: 50
      });
    }
  });

  afterAll(async () => {
    // Reset test artifacts
    if (marieGoldProduct) {
      await BranchInventory.findOneAndUpdate(
        { branchId: 'dmart-kukatpally', productId: marieGoldProduct._id },
        { stockQuantity: 48, reservedQuantity: 0, available: true }
      );
    }
    await disconnectDB();
  });

  beforeEach(async () => {
    // Clear carts and active reservations for test users and test products before each test
    await Cart.deleteMany({ user: { $in: [customerAId, customerBId] } });
    await Reservation.deleteMany({
      $or: [
        { userId: { $in: [customerAId, customerBId] } },
        { productId: marieGoldProduct._id }
      ]
    });
  });

  // =========================================================================
  // TEST 1 — Same user scans once
  // =========================================================================
  it('TEST 1: Same user scans once -> SUCCESS, Cart = Marie Gold ×1', async () => {
    // Stock = 5
    await BranchInventory.findOneAndUpdate(
      { branchId: 'dmart-kukatpally', productId: marieGoldProduct._id },
      { stockQuantity: 5, reservedQuantity: 0, available: true }
    );

    const res = await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${customerAToken}`)
      .send({
        barcode: '8901063371040',
        branchId: 'dmart-kukatpally'
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.cart.items.length).toBe(1);
    expect(res.body.cart.items[0].barcode).toBe('8901063371040');
    expect(res.body.cart.items[0].quantity).toBe(1);
    expect(res.body.cart.itemCount).toBe(1);

    // Verify reservation created
    const reservation = await Reservation.findOne({
      userId: customerAId,
      branchId: 'dmart-kukatpally',
      productId: marieGoldProduct._id,
      status: 'reserved'
    });
    expect(reservation).not.toBeNull();
  });

  // =========================================================================
  // TEST 2 — Same user scans same product again
  // =========================================================================
  it('TEST 2: Same user scans same product again -> HTTP 409, PRODUCT_ALREADY_IN_CART', async () => {
    await BranchInventory.findOneAndUpdate(
      { branchId: 'dmart-kukatpally', productId: marieGoldProduct._id },
      { stockQuantity: 5, reservedQuantity: 0, available: true }
    );

    // First scan -> SUCCESS
    const firstScan = await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${customerAToken}`)
      .send({ barcode: '8901063371040', branchId: 'dmart-kukatpally' });
    expect(firstScan.statusCode).toBe(200);

    // Second scan of the SAME product -> REJECT
    const secondScan = await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${customerAToken}`)
      .send({ barcode: '8901063371040', branchId: 'dmart-kukatpally' });

    expect(secondScan.statusCode).toBe(409);
    expect(secondScan.body.success).toBe(false);
    expect(secondScan.body.code).toBe('PRODUCT_ALREADY_IN_CART');
    expect(secondScan.body.message).toBe('This product is already in your cart.');

    // Cart in MongoDB must STILL have quantity = 1
    const cartInDb = await Cart.findOne({ user: customerAId });
    expect(cartInDb.items.length).toBe(1);
    expect(cartInDb.items[0].quantity).toBe(1);
  });

  // =========================================================================
  // TEST 3 — Same user repeatedly scans
  // =========================================================================
  it('TEST 3: Same user repeatedly scans -> Quantity ALWAYS remains 1', async () => {
    await BranchInventory.findOneAndUpdate(
      { branchId: 'dmart-kukatpally', productId: marieGoldProduct._id },
      { stockQuantity: 5, reservedQuantity: 0, available: true }
    );

    // Initial scan
    await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${customerAToken}`)
      .send({ barcode: '8901063371040', branchId: 'dmart-kukatpally' });

    // Repeated scans
    for (let i = 0; i < 4; i++) {
      const repeatedScan = await request(app)
        .post('/api/v1/cart/items')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({ barcode: '8901063371040', branchId: 'dmart-kukatpally' });
      expect(repeatedScan.statusCode).toBe(409);
      expect(repeatedScan.body.code).toBe('PRODUCT_ALREADY_IN_CART');
    }

    const cart = await Cart.findOne({ user: customerAId });
    expect(cart.items.length).toBe(1);
    expect(cart.items[0].quantity).toBe(1);
    expect(cart.itemCount).toBe(1);
  });

  // =========================================================================
  // TEST 4 — Different user with stock available
  // =========================================================================
  it('TEST 4: Different user with stock available -> Customer B gets Marie Gold ×1', async () => {
    // Stock = 5
    await BranchInventory.findOneAndUpdate(
      { branchId: 'dmart-kukatpally', productId: marieGoldProduct._id },
      { stockQuantity: 5, reservedQuantity: 0, available: true }
    );

    // Customer A scans
    const resA = await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${customerAToken}`)
      .send({ barcode: '8901063371040', branchId: 'dmart-kukatpally' });
    expect(resA.statusCode).toBe(200);

    // Customer B scans
    const resB = await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${customerBToken}`)
      .send({ barcode: '8901063371040', branchId: 'dmart-kukatpally' });
    expect(resB.statusCode).toBe(200);
    expect(resB.body.cart.items.length).toBe(1);
    expect(resB.body.cart.items[0].barcode).toBe('8901063371040');
    expect(resB.body.cart.items[0].quantity).toBe(1);

    // BranchInventory reserved quantity is 2
    const inv = await BranchInventory.findOne({
      branchId: 'dmart-kukatpally',
      productId: marieGoldProduct._id
    });
    expect(inv.reservedQuantity).toBe(2);
  });

  // =========================================================================
  // TEST 5 — Different users with only one unit (concurrency test)
  // =========================================================================
  it('TEST 5: Different users with only 1 unit -> exactly ONE SUCCESS, exactly ONE 409 PRODUCT_SOLD_OUT', async () => {
    // Physical stock = 1, reserved = 0
    await BranchInventory.findOneAndUpdate(
      { branchId: 'dmart-kukatpally', productId: marieGoldProduct._id },
      { stockQuantity: 1, reservedQuantity: 0, available: true }
    );

    // Concurrently fire requests from Customer A and Customer B
    const [resA, resB] = await Promise.all([
      request(app)
        .post('/api/v1/cart/items')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({ barcode: '8901063371040', branchId: 'dmart-kukatpally' }),
      request(app)
        .post('/api/v1/cart/items')
        .set('Authorization', `Bearer ${customerBToken}`)
        .send({ barcode: '8901063371040', branchId: 'dmart-kukatpally' })
    ]);

    const statuses = [resA.statusCode, resB.statusCode];
    expect(statuses).toContain(200);
    expect(statuses).toContain(409);

    const successRes = resA.statusCode === 200 ? resA : resB;
    const rejectedRes = resA.statusCode === 409 ? resA : resB;

    expect(successRes.body.success).toBe(true);
    expect(rejectedRes.body.success).toBe(false);
    expect(rejectedRes.body.code).toBe('PRODUCT_SOLD_OUT');
    expect(rejectedRes.body.message).toBe('Product not found or sold out.');

    // Only 1 reservation was created for either Customer A or Customer B
    const activeReservations = await Reservation.find({
      userId: { $in: [customerAId, customerBId] },
      branchId: 'dmart-kukatpally',
      productId: marieGoldProduct._id,
      status: 'reserved'
    });
    expect(activeReservations.length).toBe(1);
  });

  // =========================================================================
  // TEST 6 — Remove releases reservation
  // =========================================================================
  it('TEST 6: Remove releases reservation -> Customer B can scan', async () => {
    // Stock = 1
    await BranchInventory.findOneAndUpdate(
      { branchId: 'dmart-kukatpally', productId: marieGoldProduct._id },
      { stockQuantity: 1, reservedQuantity: 0, available: true }
    );

    // Customer A scans (success)
    const addA = await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${customerAToken}`)
      .send({ barcode: '8901063371040', branchId: 'dmart-kukatpally' });
    expect(addA.statusCode).toBe(200);

    // Customer B scans now -> rejected (sold out)
    const failB = await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${customerBToken}`)
      .send({ barcode: '8901063371040', branchId: 'dmart-kukatpally' });
    expect(failB.statusCode).toBe(409);
    expect(failB.body.code).toBe('PRODUCT_SOLD_OUT');

    // Customer A removes item
    const removeA = await request(app)
      .delete(`/api/v1/cart/items/${marieGoldProduct._id}`)
      .set('Authorization', `Bearer ${customerAToken}`);
    expect(removeA.statusCode).toBe(200);

    // Customer B scans again -> SUCCESS!
    const successB = await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${customerBToken}`)
      .send({ barcode: '8901063371040', branchId: 'dmart-kukatpally' });
    expect(successB.statusCode).toBe(200);
    expect(successB.body.cart.items.length).toBe(1);
  });

  // =========================================================================
  // TEST 7 — Different products
  // =========================================================================
  it('TEST 7: Different products -> Marie Gold ×1, Jim Jam ×1, Parle-G ×1', async () => {
    await BranchInventory.findOneAndUpdate(
      { branchId: 'dmart-kukatpally', productId: marieGoldProduct._id },
      { stockQuantity: 10, reservedQuantity: 0, available: true }
    );
    await BranchInventory.findOneAndUpdate(
      { branchId: 'dmart-kukatpally', productId: jimJamProduct._id },
      { stockQuantity: 10, reservedQuantity: 0, available: true },
      { upsert: true }
    );
    await BranchInventory.findOneAndUpdate(
      { branchId: 'dmart-kukatpally', productId: parleGProduct._id },
      { stockQuantity: 10, reservedQuantity: 0, available: true },
      { upsert: true }
    );

    // Scan Marie Gold
    const scan1 = await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${customerAToken}`)
      .send({ barcode: '8901063371040', branchId: 'dmart-kukatpally' });
    expect(scan1.statusCode).toBe(200);

    // Scan Jim Jam
    const scan2 = await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${customerAToken}`)
      .send({ barcode: '8901063029255', branchId: 'dmart-kukatpally' });
    expect(scan2.statusCode).toBe(200);

    // Scan Parle-G
    const scan3 = await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${customerAToken}`)
      .send({ barcode: '8901719101032', branchId: 'dmart-kukatpally' });
    expect(scan3.statusCode).toBe(200);

    const cart = await Cart.findOne({ user: customerAId });
    expect(cart.items.length).toBe(3);
    expect(cart.items.every(it => it.quantity === 1)).toBe(true);

    // Scanning Marie Gold again must still be rejected
    const repeatScan = await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${customerAToken}`)
      .send({ barcode: '8901063371040', branchId: 'dmart-kukatpally' });
    expect(repeatScan.statusCode).toBe(409);
    expect(repeatScan.body.code).toBe('PRODUCT_ALREADY_IN_CART');
  });

  // =========================================================================
  // TEST 8 — Same product duplicate cart line
  // =========================================================================
  it('TEST 8: Verify database/cart cannot contain duplicate active cart lines for same user + branch + product', async () => {
    await BranchInventory.findOneAndUpdate(
      { branchId: 'dmart-kukatpally', productId: marieGoldProduct._id },
      { stockQuantity: 10, reservedQuantity: 0, available: true }
    );

    await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${customerAToken}`)
      .send({ barcode: '8901063371040', branchId: 'dmart-kukatpally' });

    await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${customerAToken}`)
      .send({ barcode: '8901063371040', branchId: 'dmart-kukatpally' });

    const cart = await Cart.findOne({ user: customerAId });
    const matchingItems = cart.items.filter(
      it => it.product.toString() === marieGoldProduct._id.toString()
    );
    expect(matchingItems.length).toBe(1);
    expect(matchingItems[0].quantity).toBe(1);
  });

  // =========================================================================
  // TEST 9 — Stock limit (Stock = 0)
  // =========================================================================
  it('TEST 9: Stock = 0 -> 409 PRODUCT_SOLD_OUT ("Product not found or sold out.")', async () => {
    // Set stock = 0
    await BranchInventory.findOneAndUpdate(
      { branchId: 'dmart-kukatpally', productId: marieGoldProduct._id },
      { stockQuantity: 0, reservedQuantity: 0, available: true }
    );

    const res = await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${customerAToken}`)
      .send({ barcode: '8901063371040', branchId: 'dmart-kukatpally' });

    expect(res.statusCode).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('PRODUCT_SOLD_OUT');
    expect(res.body.message).toBe('Product not found or sold out.');
  });

  // =========================================================================
  // TEST 10 — Payment success
  // =========================================================================
  it('TEST 10: Payment success -> reservation finalized, inventory decremented exactly once, ExitPass generated', async () => {
    // Initial stock = 5
    await BranchInventory.findOneAndUpdate(
      { branchId: 'dmart-kukatpally', productId: marieGoldProduct._id },
      { stockQuantity: 5, reservedQuantity: 0, available: true }
    );

    // Customer A reserves Marie Gold (₹5)
    await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${customerAToken}`)
      .send({ barcode: '8901063371040', branchId: 'dmart-kukatpally' });

    // Checkout
    const checkoutRes = await request(app)
      .post('/api/v1/transactions/checkout')
      .set('Authorization', `Bearer ${customerAToken}`)
      .send({ branchId: 'dmart-kukatpally' });
    expect([200, 201]).toContain(checkoutRes.statusCode);
    const orderId = checkoutRes.body.order?._id || checkoutRes.body.transaction?._id;

    // Simulate inbound payment (500 paise = ₹5)
    await request(app)
      .post('/api/v1/payments/simulate-upi')
      .set('Authorization', `Bearer ${customerAToken}`)
      .send({ orderId, amountPaise: 500, status: 'captured' });

    // Verify payment
    const verifyRes = await request(app)
      .post('/api/v1/payments/verify')
      .set('Authorization', `Bearer ${customerAToken}`)
      .send({ orderId });

    expect(verifyRes.statusCode).toBe(200);
    expect(verifyRes.body.paymentStatus).toBe('PAYMENT_SUCCESS');

    // ExitPass generated
    expect(verifyRes.body.exitToken).toBeDefined();
    const pass = await ExitPass.findOne({ orderId });
    expect(pass).not.toBeNull();

    // Inventory decremented exactly once: 5 -> 4
    const invAfter = await BranchInventory.findOne({
      branchId: 'dmart-kukatpally',
      productId: marieGoldProduct._id
    });
    expect(invAfter.stockQuantity).toBe(4);
    expect(invAfter.reservedQuantity).toBe(0);

    // Reservation marked as 'sold'
    const soldReservation = await Reservation.findOne({
      userId: customerAId,
      productId: marieGoldProduct._id,
      status: 'sold'
    });
    expect(soldReservation).not.toBeNull();
  });

  // =========================================================================
  // TEST 11 — Payment cancellation
  // =========================================================================
  it('TEST 11: Payment cancellation -> reservation released, stock returns to 5, NO ExitPass', async () => {
    // Initial stock = 5
    await BranchInventory.findOneAndUpdate(
      { branchId: 'dmart-kukatpally', productId: marieGoldProduct._id },
      { stockQuantity: 5, reservedQuantity: 0, available: true }
    );

    // Customer A reserves item
    await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${customerAToken}`)
      .send({ barcode: '8901063371040', branchId: 'dmart-kukatpally' });

    // Checkout
    const checkoutRes = await request(app)
      .post('/api/v1/transactions/checkout')
      .set('Authorization', `Bearer ${customerAToken}`)
      .send({ branchId: 'dmart-kukatpally' });
    const orderId = checkoutRes.body.order?._id || checkoutRes.body.transaction?._id;

    // Customer cancels order
    const cancelRes = await request(app)
      .post(`/api/v1/transactions/${orderId}/cancel`)
      .set('Authorization', `Bearer ${customerAToken}`);

    expect(cancelRes.statusCode).toBe(200);
    expect(cancelRes.body.success).toBe(true);

    // Reservation released
    const releasedReservation = await Reservation.findOne({
      userId: customerAId,
      productId: marieGoldProduct._id,
      status: 'released'
    });
    expect(releasedReservation).not.toBeNull();

    // Available stock remains 5, reservedQuantity is 0
    const inv = await BranchInventory.findOne({
      branchId: 'dmart-kukatpally',
      productId: marieGoldProduct._id
    });
    expect(inv.stockQuantity).toBe(5);
    expect(inv.reservedQuantity).toBe(0);

    // NO ExitPass created for cancelled order
    const pass = await ExitPass.findOne({ orderId });
    expect(pass).toBeNull();
  });

  // =========================================================================
  // TEST 12 — User isolation
  // =========================================================================
  it('TEST 12: User isolation -> Customer B cannot see Customer A cart or modify Customer A reservation', async () => {
    await BranchInventory.findOneAndUpdate(
      { branchId: 'dmart-kukatpally', productId: marieGoldProduct._id },
      { stockQuantity: 5, reservedQuantity: 0, available: true }
    );

    // Customer A reserves item
    await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${customerAToken}`)
      .send({ barcode: '8901063371040', branchId: 'dmart-kukatpally' });

    // Customer B requests cart -> Customer B sees EMPTY cart
    const cartB = await request(app)
      .get('/api/v1/cart')
      .set('Authorization', `Bearer ${customerBToken}`);
    expect(cartB.statusCode).toBe(200);
    expect(cartB.body.cart.items.length).toBe(0);

    // Customer B attempts to delete Customer A item -> does not alter Customer A cart
    await request(app)
      .delete(`/api/v1/cart/items/${marieGoldProduct._id}`)
      .set('Authorization', `Bearer ${customerBToken}`);

    // Customer A cart is completely untouched
    const cartA = await request(app)
      .get('/api/v1/cart')
      .set('Authorization', `Bearer ${customerAToken}`);
    expect(cartA.statusCode).toBe(200);
    expect(cartA.body.cart.items.length).toBe(1);
    expect(cartA.body.cart.items[0].barcode).toBe('8901063371040');
  });
});
