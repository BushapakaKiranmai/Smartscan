const request = require('supertest');
const app = require('../app');

describe('Auth Endpoints Structure', () => {
  it('POST /api/v1/auth/login should respond to route request', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({});
    expect([200, 400, 422]).toContain(res.statusCode);
  });

  it('GET /api/v1/auth/me should reject unauthenticated request with 401', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.statusCode).toBe(401);
    expect(res.body.success).toBe(false);
  });
});
