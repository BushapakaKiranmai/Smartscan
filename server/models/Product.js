const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true
    },
    barcode: {
      type: String,
      required: [true, 'Barcode is required'],
      unique: true,
      index: true,
      trim: true
    },
    brand: {
      type: String,
      trim: true,
      default: ''
    },
    category: {
      type: String,
      trim: true,
      default: 'Grocery'
    },
    unit: {
      type: String,
      trim: true,
      default: 'PCS'
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [0, 'Price must be a positive number']
    },
    stock: {
      type: Number,
      required: [true, 'Stock is required'],
      min: [0, 'Stock must be a non-negative integer'],
      default: 0
    },
    image: {
      type: String,
      default: null
    }
  },
  {
    timestamps: true
  }
);

// Optional helper to transform _id to id in JSON output
productSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id;
    return ret;
  }
});

module.exports = mongoose.model('Product', productSchema);
