const mongoose = require('mongoose');
const logger = require('../utils/logger');

const connectDB = async (retries = 5, delay = 5000) => {
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/collab_docs';

  while (retries > 0) {
    try {
      logger.info(`Attempting to connect to MongoDB... (${retries} retries left)`);
      await mongoose.connect(uri);
      logger.info('MongoDB connected successfully');
      return;
    } catch (error) {
      logger.error(`MongoDB connection failed: ${error.message}`);
      retries -= 1;
      if (retries === 0) {
        logger.error('Could not connect to MongoDB after maximum retries. Exiting...');
        process.exit(1);
      }
      logger.info(`Waiting ${delay / 1000} seconds before retrying...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};

module.exports = connectDB;
