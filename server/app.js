const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const { generalLimiter } = require('./middleware/rateLimitMiddleware');
const { notFound, errorHandler } = require('./middleware/errorMiddleware');
const healthRoutes = require('./routes/healthRoutes');
const v1Routes = require('./routes/index');

const app = express();

// Security Headers
app.use(helmet());

// CORS Configuration
const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, tests) or local development origins
      if (
        !origin ||
        origin === clientUrl ||
        origin.startsWith('http://localhost:') ||
        origin.startsWith('http://127.0.0.1:') ||
        process.env.NODE_ENV !== 'production'
      ) {
        callback(null, true);
      } else {
        callback(new Error('Blocked by CORS policy'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-branch-id', 'X-Branch-Id']
  })
);

// Request Parsing
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Request Logging
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Global API Rate Limiter
app.use('/api/', generalLimiter);

// System Health Check Endpoint
app.use('/api/health', healthRoutes);

// REST API Endpoints (supports both /api and /api/v1)
app.use('/api/v1', v1Routes);
app.use('/api', v1Routes);

// 404 Catch-All Handler
app.use(notFound);

// Centralized Error Handler
app.use(errorHandler);

module.exports = app;
