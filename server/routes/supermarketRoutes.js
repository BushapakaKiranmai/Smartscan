const express = require('express');
const router = express.Router();
const { successResponse } = require('../utils/apiResponse');

// Default Supermarket: D Mart
const defaultSupermarkets = [
  {
    _id: 'dmart-main',
    name: 'D Mart',
    code: 'DMART',
    description: 'D Mart Supermarket — Autonomous Self-Checkout',
    status: 'ACTIVE'
  }
];

// Default Branches: Kukatpally, Miyapur, Madhapur
const defaultBranches = [
  {
    _id: 'dmart-kukatpally',
    supermarketId: 'dmart-main',
    branchCode: 'DMART-KUK-01',
    name: 'D Mart Kukatpally',
    latitude: 17.4849,
    longitude: 78.4138,
    address: {
      street: 'Kukatpally Main Road, Near Metro Station',
      city: 'Hyderabad',
      state: 'Telangana',
      postalCode: '500072'
    },
    operatingHours: {
      openTime: '07:00',
      closeTime: '23:00'
    },
    status: 'ACTIVE'
  },
  {
    _id: 'dmart-miyapur',
    supermarketId: 'dmart-main',
    branchCode: 'DMART-MIY-02',
    name: 'D Mart Miyapur',
    latitude: 17.4968,
    longitude: 78.3614,
    address: {
      street: 'Miyapur X Roads, Allwyn Colony',
      city: 'Hyderabad',
      state: 'Telangana',
      postalCode: '500049'
    },
    operatingHours: {
      openTime: '07:00',
      closeTime: '23:00'
    },
    status: 'ACTIVE'
  },
  {
    _id: 'dmart-madhapur',
    supermarketId: 'dmart-main',
    branchCode: 'DMART-MAD-03',
    name: 'D Mart Madhapur',
    latitude: 17.4483,
    longitude: 78.3915,
    address: {
      street: 'Hitech City Road, Madhapur',
      city: 'Hyderabad',
      state: 'Telangana',
      postalCode: '500081'
    },
    operatingHours: {
      openTime: '07:00',
      closeTime: '23:00'
    },
    status: 'ACTIVE'
  },
  // Compatibility fallback for older branch id queries
  {
    _id: 'br-indiranagar-01',
    supermarketId: 'dmart-main',
    branchCode: 'BLR-IND-01',
    name: 'D Mart Kukatpally',
    latitude: 17.4849,
    longitude: 78.4138,
    address: {
      street: 'Kukatpally Main Road',
      city: 'Hyderabad',
      postalCode: '500072'
    },
    operatingHours: {
      openTime: '07:00',
      closeTime: '23:00'
    },
    status: 'ACTIVE'
  }
];

// GET /api/v1/supermarkets
router.get('/', (req, res) => {
  return successResponse(res, 'Supermarkets fetched successfully', defaultSupermarkets);
});

// GET /api/v1/supermarkets/:id
router.get('/:id', (req, res) => {
  const store = defaultSupermarkets.find((s) => s._id === req.params.id) || defaultSupermarkets[0];
  return successResponse(res, 'Supermarket details fetched successfully', store);
});

module.exports = {
  supermarketRouter: router,
  defaultSupermarkets,
  defaultBranches
};
