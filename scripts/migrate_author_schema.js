require('dotenv').config();
const mongoose = require('mongoose');
const Document = require('../src/models/Document');
const logger = require('../src/utils/logger');
const connectDB = require('../src/config/database');

/**
 * PHASE 6: BACKGROUND MIGRATION SCRIPT
 * 
 * Schema evolution is unavoidable as applications grow. We transitioned from storing 
 * 'author' as a raw String to a structured Object. 
 * 
 * Why Zero-Downtime Migrations Matter:
 * A "stop-the-world" migration requires taking the API offline, locking the DB, and 
 * updating everything synchronously. For millions of rows, this causes massive downtime.
 * 
 * Our Strategy:
 * 1. Lazy Migration (already implemented): Transforms old data on-the-fly when requested.
 * 2. Background Migration (this script): Systematically updates the underlying data 
 *    in small batches in the background without locking the database or disrupting traffic.
 */

// Configuration
const BATCH_SIZE = parseInt(process.env.MIGRATION_BATCH_SIZE, 10) || 1000;
const IS_DRY_RUN = process.argv.includes('--dry-run');

// State tracking for graceful shutdown and idempotency
let isShuttingDown = false;

const metrics = {
  totalLegacyDocs: 0,
  processed: 0,
  updated: 0,
  failed: 0,
  batchesProcessed: 0,
  duration: '0s'
};

const handleShutdown = async (signal) => {
  logger.warn(`Received ${signal}. Gracefully stopping migration...`);
  isShuttingDown = true;
};

process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));

const runMigration = async () => {
  try {
    await connectDB();
    logger.info(`Starting Author Schema Migration (Batch Size: ${BATCH_SIZE})`);
    
    if (IS_DRY_RUN) {
      logger.info('*** DRY RUN MODE ENABLED: No database writes will be performed ***');
    }

    const startTime = Date.now();

    // 1. Startup Verification: Count legacy docs before we begin.
    // Idempotency: We explicitly filter for {$type: 'string'}. If this script crashes
    // and we restart it, it will securely pick up exactly where it left off, never 
    // reprocessing already migrated documents.
    const query = { 'metadata.author': { $type: 'string' } };
    metrics.totalLegacyDocs = await Document.countDocuments(query);

    logger.info(`Found ${metrics.totalLegacyDocs} documents requiring migration.`);

    if (metrics.totalLegacyDocs === 0) {
      logger.info('No documents require migration. Exiting.');
      process.exit(0);
    }

    // 2. Cursor Iteration
    // We use a cursor to stream documents. This prevents out-of-memory crashes 
    // that happen if you try to load millions of documents into RAM at once.
    // Projection: We strictly fetch _id and metadata.author to save network bandwidth.
    const cursor = Document.find(query).select({ _id: 1, 'metadata.author': 1 }).cursor();
    let batch = [];

    for await (const doc of cursor) {
      if (isShuttingDown) {
        logger.warn('Migration paused due to shutdown signal. Cursor closed.');
        break;
      }

      batch.push(doc);

      // 3. Process Batch
      if (batch.length >= BATCH_SIZE) {
        await processBatch(batch);
        batch = []; // Clear buffer
      }
    }

    // Process remaining documents in the final partial batch
    if (batch.length > 0 && !isShuttingDown) {
      await processBatch(batch);
    }

    // 4. Post-Migration Verification
    const remainingDocs = await Document.countDocuments(query);
    metrics.duration = ((Date.now() - startTime) / 1000).toFixed(2) + 's';

    logger.info('=============================================');
    logger.info('MIGRATION COMPLETION SUMMARY');
    logger.info('=============================================');
    console.table(metrics);
    
    if (remainingDocs === 0 && !IS_DRY_RUN && !isShuttingDown) {
      logger.info('SUCCESS: All legacy documents successfully migrated!');
    } else if (!IS_DRY_RUN) {
      logger.warn(`WARNING: ${remainingDocs} legacy documents still remain.`);
    }

    process.exit(0);
  } catch (error) {
    logger.error(`Migration failed: ${error.message}`);
    process.exit(1);
  }
};

/**
 * Processes a batch of documents and performs a bulkWrite.
 */
const processBatch = async (docs) => {
  const batchStartTime = Date.now();
  const operations = [];

  for (const doc of docs) {
    // Defensive normalization in case of empty strings
    const oldAuthorName = (typeof doc.metadata.author === 'string' && doc.metadata.author.trim() !== '') 
      ? doc.metadata.author.trim() 
      : 'Unknown';

    const newAuthorObject = {
      id: null,
      name: oldAuthorName,
      email: null
    };

    operations.push({
      updateOne: {
        filter: { _id: doc._id },
        update: { $set: { 'metadata.author': newAuthorObject } }
      }
    });
  }

  try {
    if (!IS_DRY_RUN) {
      // Why BulkWrite?
      // Sending 1000 individual updateOne() calls to the database causes 1000 network roundtrips.
      // bulkWrite bundles them into a single network request, providing massive performance gains.
      const result = await Document.bulkWrite(operations);
      metrics.updated += result.modifiedCount;
    }
    
    metrics.processed += docs.length;
    metrics.batchesProcessed += 1;
    
    const percentage = ((metrics.processed / metrics.totalLegacyDocs) * 100).toFixed(2);
    const batchDuration = Date.now() - batchStartTime;
    
    logger.info(`[Progress: ${percentage}%] Processed ${metrics.processed}/${metrics.totalLegacyDocs} docs | Batch Time: ${batchDuration}ms`);
  } catch (error) {
    metrics.failed += docs.length;
    logger.error(`Batch failed: ${error.message}`);
    // A robust migration script doesn't crash on a single bad batch.
    // The cursor safely continues, allowing us to investigate failures later.
  }
};

// Execute
runMigration();
