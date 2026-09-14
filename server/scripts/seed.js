const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const { connectDB, disconnectDB } = require('../config/db');
const User = require('../models/User');
const Product = require('../models/Product');
const Transaction = require('../models/Transaction');
const Cart = require('../models/Cart');
const ExitPass = require('../models/ExitPass');
const BranchInventory = require('../models/BranchInventory');
const BranchAvailability = require('../models/BranchAvailability');
const { initBranchAvailability } = require('../services/branchAvailabilityService');

async function seedDatabase() {
  console.log('====================================================');
  console.log('  SmartScan & Pay — Database Seeder Script          ');
  console.log('====================================================');

  try {
    const conn = await connectDB();

    // 1. Reset data in collections
    console.log('\n[1/4] Resetting data in database collections...');
    await Promise.all([
      User.deleteMany({}),
      Product.deleteMany({}),
      Transaction.deleteMany({}),
      Cart.deleteMany({}),
      ExitPass.deleteMany({}),
      BranchInventory.deleteMany({}),
      BranchAvailability.deleteMany({})
    ]);
    console.log('  ✓ Cleared users, products, transactions, carts, exit passes, and inventories');

    // 2. Seed Users
    console.log('\n[2/4] Seeding Users...');
    const defaultPassword = 'Password123!';
    const defaultPasswordHash = await bcrypt.hash(defaultPassword, 10);

    const usersToCreate = [
      {
        name: 'Rohan Customer',
        phone: '+919999911111',
        email: 'customer@smartscanpay.local',
        password: defaultPasswordHash,
        role: 'customer',
        status: 'ACTIVE'
      },
      {
        name: 'Kiran Customer',
        phone: '+919876543210',
        email: 'kiran@example.com',
        password: defaultPasswordHash,
        role: 'customer',
        status: 'ACTIVE'
      },
      {
        name: 'Vikram Admin',
        phone: '+919999944444',
        email: 'admin@smartscanpay.local',
        password: defaultPasswordHash,
        role: 'admin',
        status: 'ACTIVE'
      },
      {
        name: 'Suresh Staff',
        phone: '+919999922222',
        email: 'staff@smartscanpay.local',
        password: defaultPasswordHash,
        role: 'staff',
        status: 'ACTIVE'
      }
    ];

    for (const u of usersToCreate) {
      const created = await User.create(u);
      console.log(`  + Created User: "${created.name}" [Role: ${created.role}, Phone: ${created.phone}]`);
    }

    // 3. Seed Products (Including Britannia Jim Jam and Britannia Marie Gold)
    console.log('\n[3/4] Seeding Master Products...');
    const productsToCreate = [
      {
        name: 'Britannia Marie Gold Biscuits (36.6g)',
        barcode: '8901063371040',
        price: 5,
        stock: 50,
        image: '/images/marie_gold.jpg'
      },
      {
        name: 'Britannia Jim Jam Biscuits (57g)',
        barcode: '8901063029255',
        price: 10,
        stock: 50,
        image: 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=300&h=300&fit=crop'
      },
      {
        name: 'Amul Taaza Homogenised Toned Milk',
        barcode: '8901262010053',
        price: 54,
        stock: 80,
        image: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=300&h=300&fit=crop'
      },
      {
        name: 'Modern White Sandwich Bread',
        barcode: '8901234001011',
        price: 40,
        stock: 40,
        image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=300&h=300&fit=crop'
      },
      {
        name: 'India Gate Basmati Rice Feast Rozzana',
        barcode: '8901725181222',
        price: 110,
        stock: 60,
        image: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=300&h=300&fit=crop'
      },
      {
        name: 'Parle-G Gold Glucose Biscuits',
        barcode: '8901719101032',
        price: 120,
        stock: 100,
        image: 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=300&h=300&fit=crop'
      },
      {
        name: 'Dettol Original Bathing Soap Bar',
        barcode: '8901396316120',
        price: 58,
        stock: 75,
        image: 'https://images.unsplash.com/photo-1608248597359-0012759e0787?w=300&h=300&fit=crop'
      },
      {
        name: 'Head & Shoulders Anti-Dandruff Shampoo',
        barcode: '8901030382918',
        price: 199,
        stock: 50,
        image: 'https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?w=300&h=300&fit=crop'
      },
      {
        name: 'Fortune Sunlite Refined Sunflower Oil',
        barcode: '8906007280145',
        price: 145,
        stock: 35,
        image: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=300&h=300&fit=crop'
      }
    ];

    for (const p of productsToCreate) {
      const created = await Product.create(p);
      console.log(`  + Created Product: "${created.name}" [Barcode: ${created.barcode}, Price: ₹${created.price}, Stock: ${created.stock}]`);
    }

    // 4. Initialize Branch Inventories & Availabilities
    console.log('\n[4/4] Syncing Branch Inventory & Availability Matrix...');
    await initBranchAvailability();
    console.log('  ✓ Branch inventory synced successfully.');

    console.log('\n====================================================');
    console.log('  Database Seeding Completed Successfully!           ');
    console.log('====================================================');

    await disconnectDB();
    process.exit(0);
  } catch (error) {
    console.error('\n[FATAL SEED ERROR]:', error);
    try {
      await disconnectDB();
    } catch (_) {}
    process.exit(1);
  }
}

if (require.main === module) {
  seedDatabase();
}

module.exports = { seedDatabase };
