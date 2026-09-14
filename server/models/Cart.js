const mongoose = require('mongoose');

const cartItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    barcode: {
      type: String,
      required: true,
      trim: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    price: {
      type: Number,
      required: true,
      min: 0
    },
    unitPricePaise: {
      type: Number,
      required: true,
      default: 0
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
      default: 1
    },
    subtotal: {
      type: Number,
      required: true,
      default: 0
    },
    subtotalPaise: {
      type: Number,
      required: true,
      default: 0
    },
    image: {
      type: String,
      default: null
    }
  },
  { _id: true }
);

const cartSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true
    },
    branchId: {
      type: String,
      default: 'dmart-kukatpally'
    },
    branchName: {
      type: String,
      default: 'D Mart Kukatpally'
    },
    items: {
      type: [cartItemSchema],
      default: []
    },
    totalAmount: {
      type: Number,
      default: 0,
      min: 0
    },
    totalAmountPaise: {
      type: Number,
      default: 0,
      min: 0
    },
    itemCount: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  {
    timestamps: true
  }
);

cartSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id;
    return ret;
  }
});

module.exports = mongoose.model('Cart', cartSchema);
