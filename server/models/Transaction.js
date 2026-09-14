const mongoose = require('mongoose');

const transactionItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    barcode: {
      type: String,
      required: true,
      trim: true
    },
    price: {
      type: Number,
      required: true,
      min: 0
    },
    quantity: {
      type: Number,
      required: true,
      min: 1
    },
    subtotal: {
      type: Number,
      required: true,
      min: 0
    }
  },
  { _id: false }
);

const transactionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    branchId: {
      type: String,
      default: 'dmart-kukatpally',
      index: true,
      trim: true
    },
    items: {
      type: [transactionItemSchema],
      required: true,
      validate: [items => items && items.length > 0, 'Transaction must contain at least one item']
    },
    subtotal: {
      type: Number,
      required: true,
      min: 0
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'processing', 'paid', 'failed', 'expired', 'refunded'],
      default: 'pending'
    },
    paymentMethod: {
      type: String,
      default: 'razorpay'
    },
    razorpayOrderId: {
      type: String,
      default: null
    },
    razorpayPaymentId: {
      type: String,
      default: null
    },
    upiTransactionRef: {
      type: String,
      default: null
    },
    expectedAmountPaise: {
      type: Number,
      default: null
    },
    verifiedAmountPaise: {
      type: Number,
      default: null
    },
    verifiedAt: {
      type: Date,
      default: null
    },
    rejectionReason: {
      type: String,
      default: null
    },
    inboundPayment: {
      providerPaymentId: { type: String, default: null },
      amountPaise: { type: Number, default: null },
      status: { type: String, default: null },
      receivedAt: { type: Date, default: null }
    },
    paymentVerified: {
      type: Boolean,
      default: false
    },
    exitToken: {
      type: String,
      default: null,
      index: true
    },
    status: {
      type: String,
      enum: ['created', 'pending', 'processing', 'paid', 'failed', 'cancelled', 'completed'],
      default: 'pending'
    }
  },
  {
    timestamps: true
  }
);

transactionSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id;
    return ret;
  }
});

module.exports = mongoose.model('Transaction', transactionSchema);
