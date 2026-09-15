const mongoose = require('mongoose');

const reservationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true
    },
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
    barcode: {
      type: String,
      required: [true, 'Barcode is required'],
      trim: true
    },
    cartId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Cart',
      default: null,
      index: true
    },
    transactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Transaction',
      default: null,
      index: true
    },
    status: {
      type: String,
      enum: ['reserved', 'sold', 'released', 'expired'],
      default: 'reserved',
      index: true
    },
    quantity: {
      type: Number,
      default: 1,
      min: 1
    },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 30 * 60 * 1000), // 30 mins TTL
      index: true
    },
    releasedAt: {
      type: Date,
      default: null
    },
    soldAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

// Compound partial unique index:
// A user can hold at most ONE active reservation ('reserved') per product per branch!
reservationSchema.index(
  { userId: 1, branchId: 1, productId: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: 'reserved' } }
);

reservationSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id;
    return ret;
  }
});

module.exports = mongoose.model('Reservation', reservationSchema);
