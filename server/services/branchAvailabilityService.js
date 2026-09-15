const Product = require('../models/Product');
const BranchInventory = require('../models/BranchInventory');
const BranchAvailability = require('../models/BranchAvailability');
const { defaultBranches } = require('../routes/supermarketRoutes');

/**
 * Initialize default BranchInventory records for D Mart branches
 */
const initBranchAvailability = async () => {
  try {
    const products = await Product.find({});
    if (!products || products.length === 0) {
      return;
    }

    const branches = defaultBranches.filter((b) => !b._id.startsWith('br-'));

    // Find Britannia Marie Gold (8901063371040)
    const marieGold = products.find((p) => p.barcode === '8901063371040');

    // Desired seed configurations for Marie Gold according to user specification:
    // Kukatpally: stock = 48, available = true
    // Miyapur: stock = 0, available = false
    // Madhapur: stock = 25, available = true

    for (const branch of branches) {
      for (const prod of products) {
        let stock = prod.stock || 50;
        let isAvailable = stock > 0;

        // Specific configuration for Britannia Marie Gold
        if (prod.barcode === '8901063371040') {
          if (branch._id === 'dmart-kukatpally') {
            stock = 48;
            isAvailable = true;
          } else if (branch._id === 'dmart-miyapur') {
            stock = 0;
            isAvailable = false;
          } else if (branch._id === 'dmart-madhapur') {
            stock = 25;
            isAvailable = true;
          }
        } else if (prod.barcode === '8901063029255') {
          // Britannia Jim Jam
          if (branch._id === 'dmart-miyapur') {
            stock = 0;
            isAvailable = false;
          } else {
            stock = 30;
            isAvailable = true;
          }
        } else if (prod.barcode === '8901719101032') {
          // Parle-G Glucose Biscuits: omit from Miyapur completely to test missing inventory record!
          if (branch._id === 'dmart-miyapur') {
            continue;
          } else if (branch._id === 'dmart-kukatpally') {
            stock = 0;
            isAvailable = false;
          } else {
            stock = 40;
            isAvailable = true;
          }
        }

        // Upsert into BranchInventory
        await BranchInventory.findOneAndUpdate(
          { branchId: branch._id, productId: prod._id },
          {
            branchId: branch._id,
            productId: prod._id,
            stockQuantity: stock,
            reservedQuantity: 0,
            available: isAvailable,
            updatedAt: new Date()
          },
          { upsert: true, new: true }
        );

        // Keep legacy BranchAvailability updated as well for compatibility
        await BranchAvailability.findOneAndUpdate(
          { branchId: branch._id, barcode: prod.barcode },
          {
            branchId: branch._id,
            productId: prod._id,
            barcode: prod.barcode,
            available: isAvailable,
            stock: stock
          },
          { upsert: true, new: true }
        );
      }
    }

    console.log('[BranchInventory] Synced branch inventory records for D Mart branches.');
  } catch (err) {
    console.error('[BranchInventory] Error syncing branch inventory:', err.message);
  }
};

module.exports = { initBranchAvailability };
