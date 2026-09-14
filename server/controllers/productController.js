const Product = require('../models/Product');
const BranchInventory = require('../models/BranchInventory');
const BranchAvailability = require('../models/BranchAvailability');
const { defaultBranches } = require('../routes/supermarketRoutes');

/**
 * Scan / Find product by barcode
 * GET /api/products/barcode/:barcode
 */
exports.getProductByBarcode = async (req, res) => {
  try {
    const rawBarcode = req.params.barcode;
    if (!rawBarcode) {
      return res.status(400).json({ success: false, message: 'Barcode is required' });
    }

    const barcode = String(rawBarcode).trim();
    const product = await Product.findOne({ barcode });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    const productData = {
      id: product._id,
      _id: product._id,
      name: product.name,
      barcode: product.barcode,
      price: product.price,
      stock: product.stock,
      image: product.image,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt
    };

    // Optional branch availability check if branchId is supplied in query
    let branchAvailability = null;
    const branchId = req.query.branchId;
    if (branchId) {
      const branch =
        defaultBranches.find((b) => b._id === branchId || b.branchCode === branchId) ||
        defaultBranches[0];

      // Query BranchInventory collection
      const inventory = await BranchInventory.findOne({
        branchId: branch._id,
        productId: product._id
      });

      let isAvailable = false;
      let branchStock = 0;

      if (inventory) {
        isAvailable = inventory.available && inventory.stockQuantity > 0;
        branchStock = inventory.stockQuantity;
      } else {
        // Very important requirement: if no inventory record exists, treat as NOT AVAILABLE
        isAvailable = false;
        branchStock = 0;
      }

      productData.available = isAvailable;
      productData.stockQuantity = branchStock;

      branchAvailability = {
        branchId: branch._id,
        branchName: branch.name,
        available: isAvailable,
        stock: branchStock,
        stockQuantity: branchStock,
        message: isAvailable
          ? `✓ Available at ${branch.name}`
          : `This product is currently unavailable at ${branch.name}.`
      };
    }

    return res.status(200).json({
      success: true,
      product: productData,
      branchAvailability,
      // Compatibility fields for existing client components
      data: {
        product: productData,
        branchAvailability,
        sellingPricePaise: Math.round(product.price * 100),
        stockQuantity: branchAvailability ? branchAvailability.stockQuantity : product.stock,
        availableStock: branchAvailability ? branchAvailability.stockQuantity : product.stock
      }
    });
  } catch (error) {
    console.error('[ProductController] Error finding barcode:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while searching product by barcode',
      error: error.message
    });
  }
};

/**
 * Search products with branch-specific inventory availability
 * GET /api/v1/products/search?q=...&branchId=...
 */
exports.searchProducts = async (req, res) => {
  try {
    const { q, search, branchId } = req.query;
    const searchTerm = q || search;
    const query = {};

    if (searchTerm && searchTerm.trim()) {
      const regex = new RegExp(searchTerm.trim(), 'i');
      query.$or = [{ name: regex }, { barcode: regex }, { brand: regex }, { category: regex }];
    }

    const products = await Product.find(query).limit(50);
    const productIds = products.map((p) => p._id);

    let branch = null;
    let inventoryMap = new Map();

    if (branchId) {
      branch =
        defaultBranches.find((b) => b._id === branchId || b.branchCode === branchId) ||
        defaultBranches[0];

      const inventories = await BranchInventory.find({
        branchId: branch._id,
        productId: { $in: productIds }
      });

      inventories.forEach((inv) => {
        inventoryMap.set(inv.productId.toString(), inv);
      });
    }

    const formatted = products.map((p) => {
      const pId = p._id.toString();
      let available = false;
      let stockQuantity = 0;

      if (branch) {
        const inv = inventoryMap.get(pId);
        // CRITICAL RULE: If no inventory record exists, treat as NOT AVAILABLE
        if (inv) {
          available = Boolean(inv.available) && inv.stockQuantity > 0;
          stockQuantity = inv.stockQuantity;
        } else {
          available = false;
          stockQuantity = 0;
        }
      } else {
        available = (p.stock || 0) > 0;
        stockQuantity = p.stock || 0;
      }

      return {
        id: p._id,
        _id: p._id,
        name: p.name,
        barcode: p.barcode,
        brand: p.brand || '',
        category: p.category || 'Grocery',
        unit: p.unit || 'PCS',
        price: p.price,
        sellingPricePaise: Math.round(p.price * 100),
        image: p.image,
        available,
        stockQuantity,
        stock: stockQuantity,
        branchAvailability: branch
          ? {
              branchId: branch._id,
              branchName: branch.name,
              available,
              stockQuantity,
              message: available
                ? `✓ Available at ${branch.name}`
                : `Currently unavailable at ${branch.name}`
            }
          : null
      };
    });

    return res.status(200).json({
      success: true,
      count: formatted.length,
      products: formatted,
      data: formatted
    });
  } catch (error) {
    console.error('[ProductController] Search products error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to search products',
      error: error.message
    });
  }
};

/**
 * List products (Admin or internal search)
 * GET /api/products
 */
exports.listProducts = async (req, res) => {
  try {
    const { q, search, page = 1, limit = 50 } = req.query;
    const searchTerm = q || search;
    const query = {};

    if (searchTerm && searchTerm.trim()) {
      const regex = new RegExp(searchTerm.trim(), 'i');
      query.$or = [{ name: regex }, { barcode: regex }, { brand: regex }, { category: regex }];
    }

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 50;
    const skip = (pageNum - 1) * limitNum;

    const [products, total] = await Promise.all([
      Product.find(query).sort({ createdAt: -1 }).skip(skip).limit(limitNum),
      Product.countDocuments(query)
    ]);

    const productIds = products.map((p) => p._id);
    const inventories = await BranchInventory.find({ productId: { $in: productIds } });

    const branchInventoryMap = new Map();
    inventories.forEach((inv) => {
      const pId = inv.productId.toString();
      if (!branchInventoryMap.has(pId)) {
        branchInventoryMap.set(pId, []);
      }
      branchInventoryMap.get(pId).push({
        branchId: inv.branchId,
        stockQuantity: inv.stockQuantity,
        available: inv.available && inv.stockQuantity > 0,
        updatedAt: inv.updatedAt
      });
    });

    const formatted = products.map((p) => {
      const branchInvs = branchInventoryMap.get(p._id.toString()) || [];
      return {
        id: p._id,
        _id: p._id,
        name: p.name,
        barcode: p.barcode,
        brand: p.brand || '',
        category: p.category || 'Grocery',
        unit: p.unit || 'PCS',
        price: p.price,
        sellingPricePaise: Math.round(p.price * 100),
        stock: p.stock,
        availableStock: p.stock,
        image: p.image,
        branchInventories: branchInvs,
        createdAt: p.createdAt
      };
    });

    return res.status(200).json({
      success: true,
      products: formatted,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum),
      data: {
        products: formatted,
        total,
        pagination: { page: pageNum, totalPages: Math.ceil(total / limitNum) }
      }
    });
  } catch (error) {
    console.error('[ProductController] List products error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch products',
      error: error.message
    });
  }
};

/**
 * Create new product (Admin)
 * POST /api/products
 */
exports.createProduct = async (req, res) => {
  try {
    const rawBarcode = req.body.barcode || req.body.baseBarcode;
    const rawPrice = req.body.price !== undefined ? req.body.price : (req.body.defaultPricePaise ? req.body.defaultPricePaise / 100 : (req.body.priceRupees ? parseFloat(req.body.priceRupees) : undefined));
    const rawStock = req.body.stock !== undefined ? req.body.stock : (req.body.stockQuantity !== undefined ? req.body.stockQuantity : undefined);
    const rawImage = req.body.image || req.body.images?.[0]?.url || req.body.imageUrl || null;
    const name = req.body.name;

    if (!name || !rawBarcode || rawPrice === undefined || rawStock === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Name, barcode, price, and stock are required'
      });
    }

    const cleanBarcode = String(rawBarcode).trim();
    const existing = await Product.findOne({ barcode: cleanBarcode });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: `A product with barcode "${cleanBarcode}" already exists.`
      });
    }

    const numPrice = Number(rawPrice);
    const numStock = parseInt(rawStock, 10);

    if (isNaN(numPrice) || numPrice < 0) {
      return res.status(400).json({ success: false, message: 'Price must be a positive number' });
    }
    if (isNaN(numStock) || numStock < 0) {
      return res.status(400).json({ success: false, message: 'Stock must be a non-negative integer' });
    }

    const product = await Product.create({
      name: String(name).trim(),
      barcode: cleanBarcode,
      price: numPrice,
      stock: numStock,
      image: rawImage
    });

    return res.status(201).json({
      success: true,
      message: 'Product created successfully',
      product,
      data: product
    });
  } catch (error) {
    console.error('[ProductController] Create product error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create product',
      error: error.message
    });
  }
};

/**
 * Update existing product (Admin)
 * PUT /api/products/:id
 */
exports.updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const rawBarcode = req.body.barcode || req.body.baseBarcode;
    const rawPrice = req.body.price !== undefined ? req.body.price : (req.body.defaultPricePaise ? req.body.defaultPricePaise / 100 : (req.body.priceRupees ? parseFloat(req.body.priceRupees) : undefined));
    const rawStock = req.body.stock !== undefined ? req.body.stock : (req.body.stockQuantity !== undefined ? req.body.stockQuantity : undefined);
    const rawImage = req.body.image || req.body.images?.[0]?.url || req.body.imageUrl;
    const name = req.body.name;

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    if (rawBarcode && String(rawBarcode).trim() !== product.barcode) {
      const conflict = await Product.findOne({ barcode: String(rawBarcode).trim() });
      if (conflict) {
        return res.status(409).json({
          success: false,
          message: `Barcode "${rawBarcode}" is already in use by another product.`
        });
      }
      product.barcode = String(rawBarcode).trim();
    }

    if (name) product.name = String(name).trim();
    if (rawPrice !== undefined) {
      const numPrice = Number(rawPrice);
      if (isNaN(numPrice) || numPrice < 0) {
        return res.status(400).json({ success: false, message: 'Price must be a positive number' });
      }
      product.price = numPrice;
    }
    if (rawStock !== undefined) {
      const numStock = parseInt(rawStock, 10);
      if (isNaN(numStock) || numStock < 0) {
        return res.status(400).json({ success: false, message: 'Stock must be a non-negative integer' });
      }
      product.stock = numStock;
    }
    if (rawImage !== undefined) product.image = rawImage;

    await product.save();

    return res.status(200).json({
      success: true,
      message: 'Product updated successfully',
      product,
      data: product
    });
  } catch (error) {
    console.error('[ProductController] Update product error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update product',
      error: error.message
    });
  }
};

/**
 * Delete product (Admin)
 * DELETE /api/products/:id
 */
exports.deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findByIdAndDelete(id);

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    return res.status(200).json({
      success: true,
      message: 'Product deleted successfully'
    });
  } catch (error) {
    console.error('[ProductController] Delete product error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete product',
      error: error.message
    });
  }
};
