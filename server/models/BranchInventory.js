const mongoose = require('mongoose');

const branchInventorySchema = new mongoose.Schema(
  {
    branchId: {
      type: String,
      required: [true, 'Branch ID is required'],
      index: true,
      trim: true
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: [true, 'Product ID is required'],
      index: true
    },
    stockQuantity: {
      type: Number,
      required: [true, 'Stock quantity is required'],
      default: 0,
      min: [0, 'Stock quantity cannot be negative']
    },
    available: {
      type: Boolean,
      required: true,
      default: true
    },
    updatedAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

// Compound unique index: one product can have only one inventory record per branch
branchInventorySchema.index({ branchId: 1, productId: 1 }, { unique: true });

// Pre-save hook to ensure stockQuantity = 0 forces available = false
branchInventorySchema.pre('save', function (next) {
  if (this.stockQuantity <= 0) {
    this.stockQuantity = 0;
    this.available = false;
  }
  this.updatedAt = new Date();
  next();
});

branchInventorySchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id;
    return ret;
  }
});

module.exports = mongoose.model('BranchInventory', branchInventorySchema);
