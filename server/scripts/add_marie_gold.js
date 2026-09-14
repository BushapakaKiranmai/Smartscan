const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const { connectDB, disconnectDB } = require('../config/db');
const Product = require('../models/Product');

async function addMarieGold() {
  console.log('Connecting to MongoDB...');
  await connectDB();

  const productData = {
    name: 'Britannia Marie Gold Biscuits (36.6g)',
    barcode: '8901063371040',
    price: 5,
    stock: 50,
    image: '/images/marie_gold.jpg'
  };

  const existing = await Product.findOne({ barcode: productData.barcode });
  let result;
  if (existing) {
    console.log(`Product with barcode ${productData.barcode} already exists. Updating...`);
    existing.name = productData.name;
    existing.price = productData.price;
    existing.stock = productData.stock;
    existing.image = productData.image;
    result = await existing.save();
    console.log('Updated product successfully:');
  } else {
    console.log(`Creating new product with barcode ${productData.barcode}...`);
    result = await Product.create(productData);
    console.log('Created product successfully:');
  }

  console.log({
    id: result._id,
    name: result.name,
    barcode: result.barcode,
    price: result.price,
    stock: result.stock,
    image: result.image
  });

  const total = await Product.countDocuments();
  console.log(`Total products in database: ${total}`);

  await disconnectDB();
  process.exit(0);
}

addMarieGold().catch((err) => {
  console.error('Error adding product:', err);
  process.exit(1);
});
