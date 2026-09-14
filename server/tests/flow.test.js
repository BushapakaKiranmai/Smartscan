require('dotenv').config();
const request = require('supertest');
const app = require('../app');
const { connectDB, disconnectDB } = require('../config/db');
const Product = require('../models/Product');

describe('SmartScan Pay — Comprehensive End-to-End Backend Flow', () => {
  let customerToken = null;
  let customerId = null;
  let staffToken = null;
  let supermarketId = null;
  let branchId = null;
  let testProductId = null;
  let secondProductId = null;
  let testBarcode = '8901030382918'; // Head & Shoulders Shampoo
  let secondBarcode = '8901234001011'; // Modern White Bread
  let activeOrderId = null;
  let razorpayOrderId = null;
  let exitPassShortCode = null;
  let initialStock = 0;

  beforeAll(async () => {
    await connectDB();

    // Login as pre-seeded staff user to get staffToken for gate verification
    const staffLoginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({
        identifier: '+919999922222',
        password: 'Password123!'
      });

    expect(staffLoginRes.statusCode).toBe(200);
    staffToken = staffLoginRes.body.data.token;
  });

  afterAll(async () => {
    await disconnectDB();
  });

  // 1. Customer Registration
  it('1. Register: should register a new customer account successfully', async () => {
    const uniquePhone = `+9198${Math.floor(10000000 + Math.random() * 90000000)}`;
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'Test Customer Automated',
        phone: uniquePhone,
        email: `test_${Date.now()}@smartscanpay.local`,
        password: 'SecurePassword123!'
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('token');
    expect(res.body.data.user).toHaveProperty('_id');
    expect(res.body.data.user).not.toHaveProperty('passwordHash');

    customerToken = res.body.data.token;
    customerId = res.body.data.user._id;
  });

  // 2. Customer Login
  it('2. Login: should authenticate with valid phone and password', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        identifier: '+919999911111', // Pre-seeded Rohan Customer
        password: 'Password123!'
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('token');
    expect(res.body.data.user.phone).toBe('+919999911111');

    // Switch to seeded customer for complete shopping flow
    customerToken = res.body.data.token;
    customerId = res.body.data.user._id;
  });

  // 3. Get Current User Profile
  it('3. Get current user: should retrieve profile from JWT token', async () => {
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${customerToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user._id).toBe(customerId);
    expect(res.body.data.user).not.toHaveProperty('passwordHash');
  });

  // 4. Get Supermarkets
  it('4. Get supermarkets: should list active supermarkets', async () => {
    const res = await request(app).get('/api/v1/supermarkets');

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);

    const supermarket = res.body.data.find(s => s.code === 'SMARTSCAN-HQ');
    expect(supermarket).toBeDefined();
    supermarketId = supermarket._id;
  });

  // 5. Get Branches
  it('5. Get branches: should list branches for selected supermarket', async () => {
    const res = await request(app)
      .get('/api/v1/branches')
      .query({ supermarketId });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);

    const hitecBranch = res.body.data.find(b => b.branchCode === 'HYD-HITECH');
    expect(hitecBranch).toBeDefined();
    branchId = hitecBranch._id;
  });

  // 6. Barcode Lookup against Branch Inventory
  it('6. Barcode lookup: should return product with authoritative branch price in paise', async () => {
    const res = await request(app)
      .get(`/api/v1/products/scan/${testBarcode}`)
      .query({ branchId });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.product).toBeDefined();
    expect(res.body.data.barcode).toBe(testBarcode);
    expect(res.body.data.branchId).toBe(branchId);
    expect(res.body.data.sellingPricePaise).toBe(19900); // ₹199.00
    expect(res.body.data.isInStock).toBe(true);

    testProductId = res.body.data.product._id;
    initialStock = res.body.data.stockQuantity;
  });

  // 7. Add Product to Cart
  it('7. Add product to cart: should add item with server-authoritative pricing', async () => {
    const res = await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        branchId,
        barcode: testBarcode,
        quantity: 2
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.items.length).toBeGreaterThan(0);

    const addedItem = res.body.data.items.find(i => i.barcode === testBarcode);
    expect(addedItem).toBeDefined();
    expect(addedItem.quantity).toBe(2);
    expect(addedItem.unitPricePaise).toBe(19900);
    expect(addedItem.subtotalPaise).toBe(39800); // 19900 * 2
  });

  // 8. Update Cart Quantity
  it('8. Update cart quantity: should adjust item quantity and recalculate subtotal in paise', async () => {
    const res = await request(app)
      .patch(`/api/v1/cart/items/${testProductId}`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ quantity: 3 });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);

    const updatedItem = res.body.data.items.find(i => i.productId === testProductId);
    expect(updatedItem.quantity).toBe(3);
    expect(updatedItem.subtotalPaise).toBe(59700); // 19900 * 3
  });

  // 9. Remove Cart Item
  it('9. Remove cart item: should delete item from cart correctly', async () => {
    // First add a second item (Bread)
    const addSecondRes = await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        branchId,
        barcode: secondBarcode,
        quantity: 1
      });

    expect(addSecondRes.statusCode).toBe(200);
    const breadItem = addSecondRes.body.data.items.find(i => i.barcode === secondBarcode);
    expect(breadItem).toBeDefined();
    secondProductId = breadItem.productId;

    // Now remove Bread
    const removeRes = await request(app)
      .delete(`/api/v1/cart/items/${secondProductId}`)
      .set('Authorization', `Bearer ${customerToken}`);

    expect(removeRes.statusCode).toBe(200);
    const remainingBread = removeRes.body.data.items.find(i => i.productId === secondProductId);
    expect(remainingBread).toBeUndefined();
  });

  // 10. Checkout
  it('10. Checkout: should create PENDING_PAYMENT order with authoritative price snapshots', async () => {
    const res = await request(app)
      .post('/api/v1/orders/checkout')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({});

    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('orderNumber');
    expect(res.body.data.status).toBe('PENDING_PAYMENT');
    expect(res.body.data.pricingSummary.finalPayableAmountPaise).toBe(59700); // 3 * 19900

    activeOrderId = res.body.data._id;
  });

  // 11. Stock Reservation
  it('11. Stock reservation: should increment reservedStock in branch inventory', async () => {
    const inventory = await Inventory.findOne({ branchId, productId: testProductId });
    expect(inventory).toBeDefined();
    expect(inventory.reservedStock).toBeGreaterThanOrEqual(3);
  });

  // 12. Razorpay Order Creation
  it('12. Razorpay order creation: should initialize gateway order record', async () => {
    const res = await request(app)
      .post('/api/v1/payments/create-order')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ orderId: activeOrderId });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('razorpayOrderId');
    expect(res.body.data.amountPaise).toBe(59700);

    razorpayOrderId = res.body.data.razorpayOrderId;
  });

  // 13. Payment Verification
  it('13. Payment verification: should verify payment and capture transaction', async () => {
    const res = await request(app)
      .post('/api/v1/payments/verify')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        orderId: activeOrderId,
        razorpayOrderId,
        razorpayPaymentId: `pay_test_${Date.now()}`,
        razorpaySignature: 'mock_test_signature'
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.payment.status).toBe('CAPTURED');
  });

  // 14. Order Confirmation
  it('14. Order confirmation: should transition order status to PAID', async () => {
    const res = await request(app)
      .get(`/api/v1/orders/${activeOrderId}`)
      .set('Authorization', `Bearer ${customerToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.status).toBe('PAID');
    expect(res.body.data.paidAt).toBeDefined();
  });

  // 15. Exit Token Generation
  it('15. Exit token generation: should generate secure exit pass with fallback code', async () => {
    const res = await request(app)
      .get(`/api/v1/exit/token/${activeOrderId}`)
      .set('Authorization', `Bearer ${customerToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('ISSUED');

    // Retrieve raw code for gate testing from payment response or direct service query
    const ExitVerification = require('../models/ExitVerification');
    const exitDoc = await ExitVerification.findOne({ orderId: activeOrderId });
    expect(exitDoc).toBeDefined();
    expect(exitDoc.tokenHash).toBeDefined();
    expect(exitDoc.shortCodeHash).toBeDefined();

    // To test gate verification, use the verification service with a known mock token test
    const { generateShortCode, sha256 } = require('../utils/cryptoUtils');
    const testCode = generateShortCode();
    exitDoc.shortCodeHash = sha256(testCode.toUpperCase());
    await exitDoc.save();

    exitPassShortCode = testCode;
  });

  // 16. Gate Verification
  it('16. Gate verification: staff terminal verifies code and clears customer exit', async () => {
    const res = await request(app)
      .post('/api/v1/exit/verify')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        branchId,
        exitCode: exitPassShortCode,
        gateTerminalId: 'GATE-NORTH-01'
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.verified).toBe(true);
    expect(res.body.data.order.status).toBe('COMPLETED');
  });

  // 17. Prevent Reused Exit Token
  it('17. Prevent reused exit token: should reject subsequent exit attempt with ALREADY_USED', async () => {
    const res = await request(app)
      .post('/api/v1/exit/verify')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        branchId,
        exitCode: exitPassShortCode,
        gateTerminalId: 'GATE-NORTH-01'
      });

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    const reason = res.body.rejectionReason || res.body.errors?.rejectionReason;
    expect(reason).toBe('ALREADY_USED');
  });

  // 18. Prevent Insufficient Stock
  it('18. Prevent insufficient stock: should reject adding excessive units to cart', async () => {
    const res = await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        branchId,
        barcode: testBarcode,
        quantity: 999
      });

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
  });

  // 19. Prevent Unauthorized Requests
  it('19. Prevent unauthorized requests: should reject unauthenticated or non-staff actions', async () => {
    // 19a. Missing token on private endpoint -> 401
    const unauthRes = await request(app).get('/api/v1/auth/me');
    expect(unauthRes.statusCode).toBe(401);

    // 19b. Customer trying to access admin-only product creation -> 403
    const forbiddenRes = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        name: 'Unauthorized Item',
        barcode: '9999999999999',
        price: 100,
        stock: 10
      });

    expect(forbiddenRes.statusCode).toBe(403);
  });
});
