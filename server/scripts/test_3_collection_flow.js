const axios = require('axios');
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Product = require('../models/Product');
const Transaction = require('../models/Transaction');

async function testThreeCollectionFlow() {
  const baseURL = 'http://localhost:5000/api';

  console.log('====================================================');
  console.log('  TESTING 3-COLLECTION MVP ARCHITECTURE & SCAN FLOW ');
  console.log('====================================================');

  // 1. Barcode scanning for new Britannia Jim Jam
  console.log('\n[TEST 1] Scan Barcode for Britannia Jim Jam (8901063029255)...');
  const jimJamRes = await axios.get(`${baseURL}/products/barcode/8901063029255`);
  console.log('  Status:', jimJamRes.status);
  console.log('  Product Name:', jimJamRes.data.product.name);
  console.log('  Barcode:', jimJamRes.data.product.barcode);
  console.log('  Price: ₹' + jimJamRes.data.product.price);
  const initialStock = jimJamRes.data.product.stock;
  console.log('  Initial Stock:', initialStock);

  if (jimJamRes.data.product.name !== 'Britannia Jim Jam Biscuits (57g)') {
    throw new Error('Jim Jam name mismatch');
  }
  if (jimJamRes.data.product.price !== 10) {
    throw new Error('Jim Jam price mismatch, expected 10');
  }

  // 2. Unknown barcode check
  console.log('\n[TEST 2] Unknown Barcode Scan (9999999999999)...');
  try {
    await axios.get(`${baseURL}/products/barcode/9999999999999`);
    throw new Error('Expected 404 for unknown barcode');
  } catch (err) {
    if (err.response?.status === 404) {
      console.log('  ✓ Returned 404 cleanly:', err.response.data.message);
    } else {
      throw err;
    }
  }

  // 3. Customer Login
  console.log('\n[TEST 3] Customer Login...');
  const loginRes = await axios.post(`${baseURL}/auth/login`, {
    phone: '+919999911111',
    password: 'Password123!'
  });
  const token = loginRes.data.data.token;
  const headers = { Authorization: `Bearer ${token}` };
  console.log('  Logged in user:', loginRes.data.data.user.name);

  // 4. Create Transaction / Checkout with Jim Jam x 2 + Amul Milk x 1
  console.log('\n[TEST 4] Checkout from Frontend Cart State...');
  const checkoutRes = await axios.post(
    `${baseURL}/transactions`,
    {
      items: [
        { barcode: '8901063029255', quantity: 2 },
        { barcode: '8901262010053', quantity: 1 }
      ]
    },
    { headers }
  );

  const transaction = checkoutRes.data.transaction;
  console.log('  Transaction Created ID:', transaction._id);
  console.log('  Items in Transaction:');
  transaction.items.forEach(item => {
    console.log(`    - ${item.name}: ₹${item.price} × ${item.quantity} = ₹${item.subtotal}`);
  });
  console.log('  Total Amount: ₹' + transaction.totalAmount);
  console.log('  Payment Status:', transaction.paymentStatus);

  if (transaction.totalAmount !== 74) {
    throw new Error(`Expected total ₹74 (10*2 + 54*1), got ${transaction.totalAmount}`);
  }

  // 5. Payment Verification & Stock Update
  console.log('\n[TEST 5] Payment Verification...');
  const verifyRes = await axios.post(
    `${baseURL}/transactions/${transaction._id}/verify`,
    {
      razorpay_payment_id: `pay_test_${Date.now()}`
    },
    { headers }
  );

  console.log('  Payment Verification Result:', verifyRes.data.message);
  console.log('  Status:', verifyRes.data.transaction.status);
  console.log('  Payment Status:', verifyRes.data.transaction.paymentStatus);
  console.log('  Exit Token:', verifyRes.data.exitToken);

  // 6. Verify Stock Decrement in Products collection
  console.log('\n[TEST 6] Verifying Stock Decrement in MongoDB...');
  const updatedJimJam = await axios.get(`${baseURL}/products/barcode/8901063029255`);
  const currentStock = updatedJimJam.data.product.stock;
  console.log(`  Britannia Jim Jam Stock: ${initialStock} -> ${currentStock} (decremented by 2)`);
  if (currentStock !== initialStock - 2) {
    throw new Error(`Expected stock ${initialStock - 2}, got ${currentStock}`);
  }

  // 7. Customer History
  console.log('\n[TEST 7] Customer Transaction History...');
  const historyRes = await axios.get(`${baseURL}/transactions/my`, { headers });
  console.log('  Customer Total Transactions:', historyRes.data.transactions.length);

  // 8. Admin View
  console.log('\n[TEST 8] Admin Total Sales & Transactions...');
  const adminLogin = await axios.post(`${baseURL}/auth/login`, {
    phone: '+919999944444',
    password: 'Password123!'
  });
  const adminToken = adminLogin.data.data.token;
  const adminRes = await axios.get(`${baseURL}/transactions`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  console.log('  Total Sales: ₹' + adminRes.data.totalSales);
  console.log('  Total Transactions:', adminRes.data.count);

  // 9. Strict 3 Collections Verification in MongoDB
  console.log('\n[TEST 9] Verifying MongoDB strictly contains ONLY 3 Collections...');
  const conn = await mongoose.connect(process.env.MONGO_URI);
  const collections = await conn.connection.db.listCollections().toArray();
  const names = collections.map(c => c.name).sort();
  console.log('  Collections in MongoDB:', names);
  await mongoose.disconnect();

  const expectedCollections = ['products', 'transactions', 'users'].sort();
  if (JSON.stringify(names) !== JSON.stringify(expectedCollections)) {
    throw new Error(`Collections mismatch! Expected [products, transactions, users], got ${JSON.stringify(names)}`);
  }

  console.log('\n====================================================');
  console.log('  ALL 9 ARCHITECTURAL TESTS PASSED PERFECTLY!        ');
  console.log('====================================================');
}

testThreeCollectionFlow().catch(err => {
  console.error('\n[FATAL TEST ERROR]:', err.response?.data || err.message);
  process.exit(1);
});
