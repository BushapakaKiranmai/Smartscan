const request = require('supertest');
const app = require('../app');

describe('Product Management Security', () => {
  it('POST /api/products should reject unauthenticated request with 401', async () => {
    const res = await request(app).post('/api/products').send({ name: 'Hack Item', barcode: '111', price: 10 });
    expect(res.statusCode).toBe(401);
  });
});
