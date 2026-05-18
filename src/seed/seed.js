const { faker } = require('@faker-js/faker');
const slugify = require('slugify');
const Document = require('../models/Document');
const logger = require('../utils/logger');

const SEED_COUNT = 1000;
const BATCH_SIZE = 200;

/**
 * Generates an array of fake document objects.
 * @param {number} count - Number of documents to generate
 * @param {Set<string>} existingSlugs - Set of existing slugs to ensure uniqueness
 * @returns {Array} Array of document objects
 */
const generateDocuments = (count, existingSlugs) => {
  const docs = [];

  for (let i = 0; i < count; i++) {
    const title = faker.lorem.sentence({ min: 3, max: 8 }).replace(/\.$/, '');
    
    // Ensure uniqueness by appending a unique identifier if slug exists
    let rawSlug = slugify(title, { lower: true, strict: true });
    let slug = rawSlug;
    let attempt = 1;
    while (existingSlugs.has(slug)) {
      slug = `${rawSlug}-${faker.string.alphanumeric(6)}-${attempt}`;
      attempt++;
    }
    existingSlugs.add(slug);

    const content = faker.lorem.paragraphs({ min: 3, max: 10 }, '\n\n');
    const wordCount = content.split(/\s+/).length;
    const isOldSchema = Math.random() < 0.1; // 10% chance for old schema

    let author;
    if (isOldSchema) {
      // Intentionally simulating legacy records where author was just a string
      // This is crucial for testing backwards compatibility and migration scripts in later phases
      author = faker.person.fullName();
    } else {
      // New schema uses a structured object for better querying and data integrity
      author = {
        id: faker.string.uuid(),
        name: faker.person.fullName(),
        email: faker.internet.email()
      };
    }

    const version = faker.number.int({ min: 1, max: 10 });
    const createdAt = faker.date.past({ years: 2 });
    const updatedAt = faker.date.between({ from: createdAt, to: new Date() });

    // Generate random revision history
    const revision_history = [];
    let currentVersion = version;
    for (let v = 0; v < faker.number.int({ min: 0, max: 3 }); v++) {
      currentVersion--;
      if (currentVersion < 1) break;
      revision_history.push({
        version: currentVersion,
        updatedAt: faker.date.between({ from: createdAt, to: updatedAt }),
        authorId: isOldSchema ? "legacy-author" : faker.string.uuid(),
        contentDiff: `Diff for version ${currentVersion}`
      });
    }

    docs.push({
      slug,
      title,
      content,
      version,
      tags: faker.lorem.words(3).split(' '),
      metadata: {
        author,
        createdAt,
        updatedAt,
        wordCount
      },
      revision_history
    });
  }

  return docs;
};

const runSeed = async () => {
  try {
    const count = await Document.countDocuments();
    
    if (count > 0) {
      logger.info(`Database already contains ${count} documents. Skipping seed.`);
      return;
    }

    logger.info(`Starting database seed process for ${SEED_COUNT} documents...`);
    const startTime = Date.now();
    
    const existingSlugs = new Set();
    const allDocs = generateDocuments(SEED_COUNT, existingSlugs);

    // Batch insertion to avoid memory spikes and improve stability
    for (let i = 0; i < allDocs.length; i += BATCH_SIZE) {
      const batch = allDocs.slice(i, i + BATCH_SIZE);
      await Document.insertMany(batch);
      logger.info(`Inserted batch ${i / BATCH_SIZE + 1} of ${Math.ceil(allDocs.length / BATCH_SIZE)} (${batch.length} documents)`);
    }

    const endTime = Date.now();
    const durationSecs = ((endTime - startTime) / 1000).toFixed(2);
    logger.info(`Seed completed successfully in ${durationSecs} seconds!`);
  } catch (error) {
    logger.error(`Seed process failed: ${error.message}`);
    // Re-throw to handle it in server.js
    throw error;
  }
};

module.exports = runSeed;

// Allow running seed script directly via `npm run seed`
if (require.main === module) {
  require('dotenv').config();
  const connectDB = require('../config/database');
  
  (async () => {
    await connectDB();
    await runSeed();
    process.exit(0);
  })();
}
