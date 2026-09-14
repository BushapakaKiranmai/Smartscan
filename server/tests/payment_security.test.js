require('dotenv').config();
const request = require('supertest');
const app = require('../app');
const { connectDB, disconnectDB } = require('../config/db');
const Product = require('../models/Product');
const Transaction = require('../models/Transaction');

jest.setTimeout(30000);

describe('SmartScan Pay — Payment Security & Server Verification Flow', () => {
  let customerToken = null;
  let marieGoldProduct = null;
  const marieGoldBarcode = '8901063371040';

  beforeAll(async () => {
    await connectDB();

    // Register test customer
    const uniquePhone = `+9197${Math.floor(10000000 + Math.random() * 90000000)}`;
    const regRes = await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'Payment Security Tester',
        phone: uniquePhone,
        email: `tester_${Date.now()}@smartscanpay.local`,
        password: 'Password123!'
      });

    expect(regRes.statusCode).toBe(201);
    customerToken = regRes.body.data.token;

    // Verify Britannia Marie Gold exists in database
    marieGoldProduct = await Product.findOne({ barcode: marieGoldBarcode });
    expect(marieGoldProduct).toBeDefined();
    expect(marieGoldProduct.price).toBe(5);
  });

  afterAll(async () => {
    await disconnectDB();
  });

  // TEST 0: Barcode API Integrity
  it('Verify Barcode API returns Britannia Marie Gold (₹5.00)', async () => {
    const res = await request(app)
      .get(`/api/v1/products/barcode/${marieGoldBarcode}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.product.name).toContain('Britannia Marie Gold');
    expect(res.body.product.price).toBe(5);
  });

  // TEST CASE 1: Open payment page. Do NOT scan/pay. Click "Verify Payment".
  // EXPECTED: Payment remains PAYMENT_PENDING. NO Exit Pass. Stock untouched.
  it('Test Case 1: Clicking Verify Payment without paying MUST remain PAYMENT_PENDING without issuing an exit pass', async () => {
    const initialStock = (await Product.findById(marieGoldProduct._id)).stock;

    // 1. Customer creates checkout transaction with 1x Marie Gold (₹5.00 = 500 paise)
    const checkoutRes = await request(app)
      .post('/api/v1/transactions/checkout')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        items: [
          {
            productId: marieGoldProduct._id,
            barcode: marieGoldBarcode,
            quantity: 1
          }
        ]
      });

    expect(checkoutRes.statusCode).toBe(201);
    const orderId = checkoutRes.body.order._id;
    expect(checkoutRes.body.order.totalAmount).toBe(5);

    // 2. Customer clicks "Verify Payment" WITHOUT paying
    const verifyRes = await request(app)
      .post('/api/v1/payments/verify')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        orderId: orderId
      });

    // Must be rejected or flagged as PAYMENT_PENDING
    expect(verifyRes.statusCode).toBe(400);
    expect(verifyRes.body.success).toBe(false);
    expect(verifyRes.body.paymentStatus).toBe('PAYMENT_PENDING');

    // Verify in database: Order must still be pending, exitToken MUST be null
    const txInDb = await Transaction.findById(orderId);
    expect(txInDb.paymentStatus).toBe('pending');
    expect(txInDb.status).toBe('pending');
    expect(txInDb.exitToken).toBeNull();
    expect(txInDb.paymentVerified).toBe(false);

    // Stock must NOT be deducted
    const currentStock = (await Product.findById(marieGoldProduct._id)).stock;
    expect(currentStock).toBe(initialStock);
  });

  // TEST CASE 2: Scan QR. Pay an incorrect amount (e.g. ₹4.00 instead of ₹5.00). Click "Verify Payment".
  // EXPECTED: PAYMENT_FAILED. NO Exit Pass.
  it('Test Case 2: Paying an incorrect amount MUST result in PAYMENT_FAILED and no exit pass', async () => {
    const initialStock = (await Product.findById(marieGoldProduct._id)).stock;

    // 1. Create checkout transaction with 1x Marie Gold (₹5.00 = 500 paise)
    const checkoutRes = await request(app)
      .post('/api/v1/transactions/checkout')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        items: [
          {
            productId: marieGoldProduct._id,
            barcode: marieGoldBarcode,
            quantity: 1
          }
        ]
      });

    const orderId = checkoutRes.body.order._id;

    // 2. Inbound payment reports 400 paise (₹4.00) instead of 500 paise (₹5.00)
    await request(app)
      .post('/api/v1/payments/simulate-upi')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        orderId,
        amountPaise: 400,
        status: 'captured'
      });

    // 3. Customer clicks "Verify Payment"
    const verifyRes = await request(app)
      .post('/api/v1/payments/verify')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        orderId: orderId
      });

    expect(verifyRes.statusCode).toBe(400);
    expect(verifyRes.body.success).toBe(false);
    expect(verifyRes.body.paymentStatus).toBe('PAYMENT_FAILED');
    expect(verifyRes.body.rejectionReason).toBe('AMOUNT_MISMATCH');

    // Verify in database: Order is marked failed, exitToken is null
    const txInDb = await Transaction.findById(orderId);
    expect(txInDb.paymentStatus).toBe('failed');
    expect(txInDb.exitToken).toBeNull();

    // Stock must NOT be deducted
    const currentStock = (await Product.findById(marieGoldProduct._id)).stock;
    expect(currentStock).toBe(initialStock);
  });

  // TEST CASE 3: Scan QR. Pay exact amount (₹5.00). Click "Verify Payment".
  // EXPECTED: PAYMENT_SUCCESS -> Receipt generated -> Exit Pass generated -> Stock updated.
  it('Test Case 3: Paying exact amount succeeds with PAYMENT_SUCCESS, exit pass generated, and stock updated', async () => {
    const initialStock = (await Product.findById(marieGoldProduct._id)).stock;

    // 1. Create checkout transaction with 1x Marie Gold (₹5.00 = 500 paise)
    const checkoutRes = await request(app)
      .post('/api/v1/transactions/checkout')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        items: [
          {
            productId: marieGoldProduct._id,
            barcode: marieGoldBarcode,
            quantity: 1
          }
        ]
      });

    const orderId = checkoutRes.body.order._id;

    // 2. Inbound payment reports EXACT 500 paise (₹5.00)
    await request(app)
      .post('/api/v1/payments/simulate-upi')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        orderId,
        amountPaise: 500,
        status: 'captured'
      });

    // 3. Customer clicks "Verify Payment"
    const verifyRes = await request(app)
      .post('/api/v1/payments/verify')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        orderId: orderId
      });

    expect(verifyRes.statusCode).toBe(200);
    expect(verifyRes.body.success).toBe(true);
    expect(verifyRes.body.paymentStatus).toBe('PAYMENT_SUCCESS');
    expect(verifyRes.body.exitToken).toBeDefined();
    expect(verifyRes.body.exitToken).toMatch(/^EXIT-/);

    // Verify in database: Order marked paid, status completed, exitToken present
    const txInDb = await Transaction.findById(orderId);
    expect(txInDb.paymentStatus).toBe('paid');
    expect(txInDb.status).toBe('completed');
    expect(txInDb.paymentVerified).toBe(true);
    expect(txInDb.exitToken).toBe(verifyRes.body.exitToken);

    // Stock must be decremented by exactly 1
    const currentStock = (await Product.findById(marieGoldProduct._id)).stock;
    expect(currentStock).toBe(initialStock - 1);

    // TEST CASE 4: Re-verify paid order (Double Payment / Repeated Click Protection)
    // EXPECTED: Idempotent return, NO duplicate pass, NO duplicate stock deduction
    const repeatRes = await request(app)
      .post('/api/v1/payments/verify')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        orderId: orderId
      });

    expect(repeatRes.statusCode).toBe(200);
    expect(repeatRes.body.paymentStatus).toBe('PAYMENT_SUCCESS');
    expect(repeatRes.body.exitToken).toBe(verifyRes.body.exitToken);

    // Stock must still be decremented by only 1 (no double deduction)
    const stockAfterRepeat = (await Product.findById(marieGoldProduct._id)).stock;
    expect(stockAfterRepeat).toBe(initialStock - 1);
  });
});
