require('dotenv').config();

const app = require('./app');
const { connectDB, disconnectDB } = require('./config/db');
const { initBranchAvailability } = require('./services/branchAvailabilityService');

// SmartScan & Pay Server Entrypoint
const PORT = process.env.PORT || 5000;

let server = null;

const startServer = async () => {
  try {
    // 1. Connect to Database
    if (process.env.NODE_ENV !== 'test') {
      await connectDB();
      await initBranchAvailability();
    }

    // 2. Start HTTP server
    server = app.listen(PORT, () => {
      console.log(`[Server] SmartScan & Pay API running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
    });
  } catch (error) {
    console.error(`[Server Error] Bootstrapping failed: ${error.message}`);
    process.exit(1);
  }
};

// Graceful Shutdown Handler
const handleShutdown = async (signal) => {
  console.log(`[Server] ${signal} signal received. Starting graceful shutdown...`);

  if (server) {
    server.close(() => {
      console.log('[Server] HTTP server closed.');
    });
  }

  await disconnectDB();
  process.exit(0);
};

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));

// Start server if run directly
if (require.main === module) {
  startServer();
}

module.exports = { startServer };
