const mongoose = require('mongoose');

/**
 * Establishes a connection to MongoDB Atlas or local MongoDB instance.
 * Reads MONGO_URI strictly from process.env.
 */
const connectDB = async () => {
  const mongoURI = process.env.MONGO_URI;

  if (!mongoURI) {
    throw new Error('FATAL: MONGO_URI environment variable is not defined.');
  }

  try {
    const conn = await mongoose.connect(mongoURI, {
      autoIndex: true, // Builds indexes in development
      serverSelectionTimeoutMS: 5000 // Fails quickly if DB is unreachable
    });

    console.log(`[Database] MongoDB connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error(`[Database Error] Connection failure: ${error.message}`);
    throw error;
  }
};

/**
 * Closes the MongoDB connection gracefully.
 */
const disconnectDB = async () => {
  try {
    await mongoose.connection.close();
    console.log('[Database] MongoDB connection closed gracefully.');
  } catch (error) {
    console.error(`[Database Error] Graceful shutdown failure: ${error.message}`);
  }
};

module.exports = {
  connectDB,
  disconnectDB
};
