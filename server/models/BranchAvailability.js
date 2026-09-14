const mongoose = require('mongoose');

const branchAvailabilitySchema = new mongoose.Schema(
  {
    branchId: {
      type: String,
      required: true,
      index: true,
      trim: true
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true
    },
    barcode: {
      type: String,
      required: true,
      index: true,
      trim: true
    },
    available: {
      type: Boolean,
      required: true,
      default: true
    },
    stock: {
      type: Number,
      required: true,
      default: 50,
      min: 0
    }
  },
  {
    timestamps: true
  }
);

branchAvailabilitySchema.index({ branchId: 1, barcode: 1 }, { unique: true });

branchAvailabilitySchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id;
    return ret;
  }
});

module.exports = mongoose.model('BranchAvailability', branchAvailabilitySchema);
