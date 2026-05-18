require('dotenv').config();
const app = require('./src/app');
const connectDB = require('./src/config/database');
const runSeed = require('./src/seed/seed');
const logger = require('./src/utils/logger');
const mongoose = require('mongoose');

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    // 1. Connect to MongoDB with retry logic
    await connectDB();

    // 2. Run seed script if database is empty
    await runSeed();

    // 3. Start Express server
    const server = app.listen(PORT, () => {
      logger.info(`Server is running on port ${PORT}`);
    });

    // Graceful Shutdown Handling
    const shutdown = async (signal) => {
      logger.info(`Received ${signal}. Shutting down gracefully...`);
      server.close(async () => {
        logger.info('Express server closed.');
        try {
          await mongoose.connection.close(false);
          logger.info('MongoDB connection closed.');
          process.exit(0);
        } catch (err) {
          logger.error('Error during MongoDB connection closure', err);
          process.exit(1);
        }
      });

      // Force shutdown after a timeout if graceful shutdown fails
      setTimeout(() => {
        logger.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

  } catch (error) {
    logger.error(`Failed to start application: ${error.message}`);
    process.exit(1);
  }
};

startServer();
