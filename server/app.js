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
const allowedOrigins = [
  'https://smartscan-rho.vercel.app',
  'http://localhost:5173'
];

if (process.env.CLIENT_URL) {
  const envClientUrl = process.env.CLIENT_URL.trim().replace(/\/+$/, '');
  if (envClientUrl && !allowedOrigins.includes(envClientUrl)) {
    allowedOrigins.push(envClientUrl);
  }
}

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, server-to-server tests)
      if (!origin) {
        return callback(null, true);
      }

      const normalizedOrigin = origin.trim().replace(/\/+$/, '');

      if (
        allowedOrigins.includes(normalizedOrigin) ||
        normalizedOrigin.startsWith('http://localhost:') ||
        normalizedOrigin.startsWith('http://127.0.0.1:') ||
        process.env.NODE_ENV !== 'production'
      ) {
        return callback(null, true);
      }

      return callback(new Error('Blocked by CORS policy'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-branch-id', 'X-Branch-Id'],
    optionsSuccessStatus: 204
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
