require('dotenv').config();
const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');
const { connectDB, disconnectDB } = require('../config/db');
const Product = require('../models/Product');
const BranchInventory = require('../models/BranchInventory');
const Transaction = require('../models/Transaction');
const ExitPass = require('../models/ExitPass');
const User = require('../models/User');

jest.setTimeout(30000);

describe('Strict One-Time Use Exit Pass System Tests', () => {
  let customerUser;
  let customerToken;
  let anotherCustomerToken;
  let staffToken;
  let testProduct;
  const activeBranchId = 'dmart-kukatpally';

  beforeAll(async () => {
    await connectDB();

    // 1. Register test customer 1
    const custEmail1 = `strict_cust1_${Date.now()}@smartscan.io`;
    const custReg1 = await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'Strict Exit Customer 1',
        email: custEmail1,
        phone: `+9191${Math.floor(10000000 + Math.random() * 90000000)}`,
        password: 'Password@123',
        role: 'CUSTOMER'
      });
    customerToken = custReg1.body.data?.token || custReg1.body.token;
    customerUser = await User.findById(custReg1.body.data?.user?.id || custReg1.body.data?.user?._id || custReg1.body.user?._id);

    // 2. Register test customer 2 (different session/device simulation)
    const custEmail2 = `strict_cust2_${Date.now()}@smartscan.io`;
    const custReg2 = await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'Strict Exit Customer 2',
        email: custEmail2,
        phone: `+9192${Math.floor(10000000 + Math.random() * 90000000)}`,
        password: 'Password@123',
        role: 'CUSTOMER'
      });
    anotherCustomerToken = custReg2.body.data?.token || custReg2.body.token;

    // 3. Register gate terminal staff
    const staffEmail = `gate_guard_${Date.now()}@smartscan.io`;
    const staffReg = await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'Gate Guard Security',
        email: staffEmail,
        phone: `+9193${Math.floor(10000000 + Math.random() * 90000000)}`,
        password: 'Password@123',
        role: 'BRANCH_STAFF'
      });
    staffToken = staffReg.body.data?.token || staffReg.body.token;

    // 4. Ensure test product exists
    testProduct = await Product.findOne({ barcode: '8901063371040' });
    if (!testProduct) {
      testProduct = await Product.create({
        name: 'Strict Test Product',
        barcode: '8901063371040',
        price: 15,
        stock: 100
      });
    }

    await BranchInventory.findOneAndUpdate(
      { branchId: activeBranchId, productId: testProduct._id },
      { stockQuantity: 100, available: true, updatedAt: new Date() },
      { upsert: true }
    );
  });

  afterAll(async () => {
    if (customerUser) {
      await Transaction.deleteMany({ userId: customerUser._id });
      await ExitPass.deleteMany({ userId: customerUser._id });
    }
    await disconnectDB();
  });

  // Helper to create and pay for an order
  async function createPaidOrderAndPass() {
    const tx = await Transaction.create({
      userId: customerUser._id,
      branchId: activeBranchId,
      items: [
        {
          productId: testProduct._id,
          name: testProduct.name,
          barcode: testProduct.barcode,
          price: testProduct.price,
          quantity: 1,
          subtotal: testProduct.price
        }
      ],
      subtotal: testProduct.price,
      totalAmount: testProduct.price,
      paymentStatus: 'pending',
      paymentMethod: 'upi',
      status: 'pending'
    });

    await request(app)
      .post('/api/v1/transactions/simulate-upi')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        orderId: tx._id,
        amountPaise: Math.round(testProduct.price * 100),
        status: 'captured'
      });

    const verifyRes = await request(app)
      .post(`/api/v1/transactions/${tx._id}/verify`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({});

    expect(verifyRes.statusCode).toBe(200);
    const pass = await ExitPass.findOne({ orderId: tx._id });
    expect(pass).not.toBeNull();
    return { tx, pass };
  }

  // TEST CASE 1: Create paid order -> generate pass -> scan once
  // Expected: SUCCESS (EXIT_AUTHORIZED), ACTIVE -> USED
  it('Test Case 1: Create paid order -> generate pass -> scan once -> SUCCESS (ACTIVE -> USED)', async () => {
    const { tx, pass } = await createPaidOrderAndPass();
    expect(pass.status).toBe('ACTIVE');
    expect(pass.usedAt).toBeNull();
    expect(pass.passId).toBeDefined();

    // Scan at Gate Endpoint POST /api/v1/exit-passes/verify
    const res = await request(app)
      .post('/api/v1/exit-passes/verify')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        passId: pass.passId,
        gateTerminalId: 'GATE-TERMINAL-01'
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.code).toBe('EXIT_AUTHORIZED');
    expect(res.body.passStatus).toBe('USED');
    expect(res.body.verified).toBe(true);
    expect(res.body.usedAt).toBeDefined();

    // Verify database document state
    const dbPass = await ExitPass.findById(pass._id);
    expect(dbPass.status).toBe('USED');
    expect(dbPass.usedAt).not.toBeNull();

    const dbTx = await Transaction.findById(tx._id);
    expect(dbTx.status).toBe('completed');
  });

  // TEST CASE 2: Scan exact same QR again
  // Expected: FAIL, PASS_ALREADY_USED
  it('Test Case 2: Scan exact same QR again -> FAIL (PASS_ALREADY_USED)', async () => {
    const { pass } = await createPaidOrderAndPass();

    // First scan -> Success
    const firstScan = await request(app)
      .post('/api/v1/exit-passes/verify')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ passId: pass.passId });
    expect(firstScan.statusCode).toBe(200);
    expect(firstScan.body.code).toBe('EXIT_AUTHORIZED');

    // Second scan -> Rejection with PASS_ALREADY_USED
    const secondScan = await request(app)
      .post('/api/v1/exit-passes/verify')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ passId: pass.passId });

    expect(secondScan.statusCode).toBe(400);
    expect(secondScan.body.success).toBe(false);
    expect(secondScan.body.code).toBe('PASS_ALREADY_USED');
    expect(secondScan.body.message).toContain('already been used');
    expect(secondScan.body.passStatus).toBe('USED');
  });

  // TEST CASE 3: Refresh Exit Pass page after successful scan
  // Expected: Backend returns status = USED
  it('Test Case 3: Refresh Exit Pass page after successful scan -> returns USED state from backend', async () => {
    const { tx, pass } = await createPaidOrderAndPass();

    // Scan once at gate
    await request(app)
      .post('/api/v1/exit-passes/verify')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ passId: pass.passId });

    // Client refreshes or calls GET /api/v1/exit-passes/:orderId
    const refreshRes = await request(app)
      .get(`/api/v1/exit-passes/${tx._id}`)
      .set('Authorization', `Bearer ${customerToken}`);

    expect(refreshRes.statusCode).toBe(200);
    expect(refreshRes.body.success).toBe(true);
    expect(refreshRes.body.data.status).toBe('USED');
    expect(refreshRes.body.data.usedAt).not.toBeNull();
  });

  // TEST CASE 4: Open same QR on another browser/device and scan
  // Expected: PASS_ALREADY_USED
  it('Test Case 4: Open same QR on another device/browser session and scan -> PASS_ALREADY_USED', async () => {
    const { pass } = await createPaidOrderAndPass();

    // First scan consumed at gate
    await request(app)
      .post('/api/v1/exit-passes/verify')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ passId: pass.passId });

    // Different session/device attempts verification
    const otherDeviceScan = await request(app)
      .post('/api/v1/exit-passes/verify')
      .set('Authorization', `Bearer ${anotherCustomerToken}`)
      .send({ passId: pass.passId });

    expect(otherDeviceScan.statusCode).toBe(400);
    expect(otherDeviceScan.body.success).toBe(false);
    expect(otherDeviceScan.body.code).toBe('PASS_ALREADY_USED');
  });

  // TEST CASE 5: Wait until expiresAt and scan
  // Expected: PASS_EXPIRED
  it('Test Case 5: Pass past expiresAt is scanned -> PASS_EXPIRED', async () => {
    const { pass } = await createPaidOrderAndPass();

    // Set expiration to 5 minutes in the past
    pass.expiresAt = new Date(Date.now() - 5 * 60 * 1000);
    await pass.save();

    // Attempt scan at gate
    const scanRes = await request(app)
      .post('/api/v1/exit-passes/verify')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ passId: pass.passId });

    expect(scanRes.statusCode).toBe(400);
    expect(scanRes.body.success).toBe(false);
    expect(scanRes.body.code).toBe('PASS_EXPIRED');
    expect(scanRes.body.message).toContain('expired');

    // Verify status was updated in DB
    const dbPass = await ExitPass.findById(pass._id);
    expect(dbPass.status).toBe('EXPIRED');
  });

  // TEST CASE 6: Try to generate another pass for the same order
  // Expected: Return existing pass instead of creating another active pass
  it('Test Case 6: Multiple payment verification calls return existing pass without creating duplicates', async () => {
    const { tx, pass } = await createPaidOrderAndPass();

    // Call verifyPayment again for the same order
    const repeatVerify = await request(app)
      .post(`/api/v1/transactions/${tx._id}/verify`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({});

    expect(repeatVerify.statusCode).toBe(200);
    expect(repeatVerify.body.exitToken).toBe(pass.passId || pass.uniquePassId);

    // Verify only ONE ExitPass exists for this order in MongoDB
    const passCount = await ExitPass.countDocuments({ orderId: tx._id });
    expect(passCount).toBe(1);
  });

  // TEST CASE 7: Send two verification requests simultaneously (Concurrency / Race Condition Guard)
  // Expected: Exactly ONE succeeds, the other receives PASS_ALREADY_USED
  it('Test Case 7: Send two verification requests simultaneously -> exactly ONE succeeds, other gets PASS_ALREADY_USED', async () => {
    const { pass } = await createPaidOrderAndPass();

    // Fire 2 concurrent requests at the exact same millisecond
    const [res1, res2] = await Promise.all([
      request(app)
        .post('/api/v1/exit-passes/verify')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ passId: pass.passId, gateTerminalId: 'GATE-01' }),
      request(app)
        .post('/api/v1/exit-passes/verify')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ passId: pass.passId, gateTerminalId: 'GATE-02' })
    ]);

    const results = [res1, res2];
    const successResult = results.find(r => r.statusCode === 200);
    const rejectedResult = results.find(r => r.statusCode === 400);

    // Exactly one must succeed
    expect(successResult).toBeDefined();
    expect(successResult.body.success).toBe(true);
    expect(successResult.body.code).toBe('EXIT_AUTHORIZED');

    // Exactly one must be rejected with PASS_ALREADY_USED
    expect(rejectedResult).toBeDefined();
    expect(rejectedResult.body.success).toBe(false);
    expect(rejectedResult.body.code).toBe('PASS_ALREADY_USED');

    // Pass in DB must be USED exactly once
    const finalPass = await ExitPass.findById(pass._id);
    expect(finalPass.status).toBe('USED');
    expect(finalPass.usedAt).not.toBeNull();
  });

  // TEST CASE 8: Shortcode verification
  // Expected: 6-character shortcode verifies the pass and is consumed together
  it('Test Case 8: 6-character shortcode verifies pass and becomes USED immediately', async () => {
    const { pass } = await createPaidOrderAndPass();
    expect(pass.shortCode).toBeDefined();
    expect(pass.shortCode.length).toBe(6);

    // Verify using shortCode
    const scanRes = await request(app)
      .post('/api/v1/exit-passes/verify')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ shortCode: pass.shortCode });

    expect(scanRes.statusCode).toBe(200);
    expect(scanRes.body.code).toBe('EXIT_AUTHORIZED');
    expect(scanRes.body.passStatus).toBe('USED');

    // Trying shortcode again must fail
    const repeatScan = await request(app)
      .post('/api/v1/exit-passes/verify')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ shortCode: pass.shortCode });

    expect(repeatScan.statusCode).toBe(400);
    expect(repeatScan.body.code).toBe('PASS_ALREADY_USED');
  });
});
