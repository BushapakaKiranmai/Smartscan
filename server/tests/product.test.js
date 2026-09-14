require('dotenv').config();
const request = require('supertest');
const app = require('../app');
const { connectDB, disconnectDB } = require('../config/db');

describe('Product Endpoints Structure', () => {
  beforeAll(async () => {
    await connectDB();
  });

  afterAll(async () => {
    await disconnectDB();
  });

  it('GET /api/v1/products/scan/:barcode should be reachable', async () => {
    const res = await request(app).get('/api/v1/products/scan/8901030382918');
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('product');
  });

  it('GET /api/products/barcode/8901262010053 should return Amul Milk', async () => {
    const res = await request(app).get('/api/products/barcode/8901262010053');
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.product.name).toMatch(/Milk/i);
    expect(res.body.product.price).toBe(54);
    expect(res.body.product.stock).toBeGreaterThanOrEqual(1);
  });

  it('GET /api/products/barcode/8901063371040 should return Britannia Marie Gold Biscuits', async () => {
    const res = await request(app).get('/api/products/barcode/8901063371040');
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.product.name).toMatch(/Marie Gold/i);
    expect(res.body.product.barcode).toBe('8901063371040');
    expect(res.body.product.price).toBe(5);
    expect(res.body.product.stock).toBeGreaterThanOrEqual(1);
  });

  it('GET /api/products/barcode/8901063029255 should return Britannia Jim Jam Biscuits', async () => {
    const res = await request(app).get('/api/products/barcode/8901063029255');
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.product.name).toMatch(/Jim Jam/i);
    expect(res.body.product.barcode).toBe('8901063029255');
    expect(res.body.product.price).toBe(10);
    expect(res.body.product.stock).toBeGreaterThanOrEqual(1);
  });

  it('GET /api/products/barcode/9999999999999 should return 404 for unknown barcode', async () => {
    const res = await request(app).get('/api/products/barcode/9999999999999');
    expect(res.statusCode).toBe(404);
    expect(res.body.success).toBe(false);
  });
});
