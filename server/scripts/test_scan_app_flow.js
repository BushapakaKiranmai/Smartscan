const axios = require('axios');

async function testScanAppFlow() {
  const baseURL = 'http://localhost:5000/api/v1';

  console.log('--- TESTING SCAN-FIRST PAYMENT APP FLOW ---');

  console.log('1. Customer Login...');
  const loginRes = await axios.post(`${baseURL}/auth/login`, {
    phone: '+919999911111',
    password: 'Password123!'
  });
  const token = loginRes.data.data.token;
  const headers = { Authorization: `Bearer ${token}` };
  console.log('   Logged in:', loginRes.data.data.user.name);

  console.log('2. Clear active cart...');
  await axios.delete(`${baseURL}/cart`, { headers });

  console.log('3. Scan Product Barcode (8901262010053)...');
  const scanRes = await axios.get(`${baseURL}/products/scan/8901262010053`);
  console.log('   Product:', scanRes.data.data.product.name);
  console.log('   Price:', scanRes.data.data.sellingPricePaise / 100);
  console.log('   Stock:', scanRes.data.data.availableStock ?? scanRes.data.data.stockQuantity);

  console.log('4. Add to Cart...');
  const addRes = await axios.post(`${baseURL}/cart/items`, {
    barcode: '8901262010053',
    quantity: 1
  }, { headers });
  console.log('   Cart updated! Items in cart:', addRes.data.data.itemCount);
  console.log('   Cart Total: ₹' + (addRes.data.data.pricingSummary.finalPayableAmountPaise / 100));

  console.log('5. Scan another product (8901234001011 - Modern Bread)...');
  const scan2 = await axios.get(`${baseURL}/products/scan/8901234001011`);
  console.log('   Product 2:', scan2.data.data.product.name);

  console.log('6. Add Product 2 to Cart...');
  const add2 = await axios.post(`${baseURL}/cart/items`, {
    barcode: '8901234001011',
    quantity: 2
  }, { headers });
  console.log('   Cart count:', add2.data.data.itemCount, '| Total: ₹' + (add2.data.data.pricingSummary.finalPayableAmountPaise / 100));

  console.log('7. Retrieve active cart for checkout summary...');
  const cartRes = await axios.get(`${baseURL}/cart`, { headers });
  console.log('   Active Cart Items:');
  cartRes.data.data.items.forEach(item => {
    console.log(`   - ${item.name}: ₹${item.unitPricePaise / 100} × ${item.quantity} = ₹${item.subtotalPaise / 100}`);
  });
  console.log('   Final Payable: ₹' + (cartRes.data.data.pricingSummary.finalPayableAmountPaise / 100));

  console.log('\n--- ALL TEST CHECKS PASSED ---');
}

testScanAppFlow().catch(err => {
  console.error('Test error:', err.response?.data || err.message);
  process.exit(1);
});
