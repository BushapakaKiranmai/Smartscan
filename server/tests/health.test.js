const request = require('supertest');
const app = require('../app');

describe('GET /api/health', () => {
  it('should return 200 with status and success message without exposing credentials', async () => {
    const res = await request(app).get('/api/health');

    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe('SmartScan & Pay API is running');
    expect(res.body).toHaveProperty('timestamp');
    expect(res.body).toHaveProperty('environment');

    // Security check: Never expose credentials or connection strings
    expect(res.body).not.toHaveProperty('database');
    expect(res.body).not.toHaveProperty('mongoUri');
    expect(res.body).not.toHaveProperty('secrets');
  });
});
