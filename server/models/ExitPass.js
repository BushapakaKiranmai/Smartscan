const mongoose = require('mongoose');

const exitPassItemSchema = new mongoose.Schema(
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
const crypto = require('crypto');

const exitPassSchema = new mongoose.Schema(
  {
    passId: {
      type: String,
      unique: true,
      index: true,
      trim: true
    },
    uniquePassId: {
      type: String,
      unique: true,
      index: true,
      trim: true
    },
    shortCode: {
      type: String,
      index: true,
      trim: true,
      uppercase: true
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Transaction',
      required: true,
      unique: true,
      index: true
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    branchId: {
      type: String,
      required: true,
      index: true,
      trim: true
    },
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    amountPaise: {
      type: Number,
      required: true,
      min: 0
    },
    items: {
      type: [exitPassItemSchema],
      required: true,
      validate: [items => items && items.length > 0, 'Exit pass must contain at least one item']
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'USED', 'EXPIRED', 'CANCELLED'],
      default: 'ACTIVE',
      index: true
    },
    verificationMethod: {
      type: String,
      enum: ['MANUAL_STAFF', 'RFID'],
      default: 'MANUAL_STAFF'
    },
    basketVerified: {
      type: Boolean,
      default: false
    },
    randomCheckSelected: {
      type: Boolean,
      default: false
    },
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    gateId: {
      type: String,
      default: null,
      trim: true
    },
    usedAt: {
      type: Date,
      default: null
    },
    expiresAt: {
      type: Date,
      required: true
    },
    mismatchNotes: {
      type: String,
      default: null
    }
  },
  {
    timestamps: true
  }
);

exitPassSchema.pre('validate', function(next) {
  if (!this.passId && this.uniquePassId) {
    this.passId = this.uniquePassId;
  }
  if (!this.uniquePassId && this.passId) {
    this.uniquePassId = this.passId;
  }
  if (!this.passId && !this.uniquePassId) {
    const randomHex = crypto.randomBytes(4).toString('hex').toUpperCase();
    const id = `PASS-SS${this.orderId ? this.orderId.toString().slice(-6).toUpperCase() : '000000'}-${randomHex}`;
    this.passId = id;
    this.uniquePassId = id;
  }
  if (!this.shortCode) {
    // Generate 6-character uppercase alphanumeric shortcode
    this.shortCode = crypto.randomBytes(3).toString('hex').toUpperCase();
  }
  next();
});

exitPassSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id;
    if (!ret.passId && ret.uniquePassId) {
      ret.passId = ret.uniquePassId;
    }
    if (!ret.uniquePassId && ret.passId) {
      ret.uniquePassId = ret.passId;
    }
    return ret;
  }
});

module.exports = mongoose.model('ExitPass', exitPassSchema);
