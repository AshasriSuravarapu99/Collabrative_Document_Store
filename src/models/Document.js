const mongoose = require('mongoose');

// The Collaborative Document Schema
const documentSchema = new mongoose.Schema({
  slug: {
    type: String,
    required: true,
    trim: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  content: {
    type: String,
    required: true
  },
  version: {
    type: Number,
    default: 1
    // The version field is crucial for Optimistic Concurrency Control (OCC)
    // in later phases to prevent lost updates when multiple users edit concurrently.
  },
  tags: {
    type: [String],
    default: []
  },
  metadata: {
    author: {
      type: mongoose.Schema.Types.Mixed, 
      // Mixed type allows us to gracefully handle the 10% old schema documents (String)
      // and the 90% new schema documents (Object) without casting errors.
      required: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    updatedAt: {
      type: Date,
      default: Date.now
    },
    wordCount: {
      type: Number,
      default: 0
    }
  },
  revision_history: [
    {
      version: Number,
      updatedAt: Date,
      authorId: String,
      contentDiff: String
    }
  ]
}, {
  // Disable automatic timestamps as requested, since we manually manage 
  // metadata.createdAt and metadata.updatedAt
  timestamps: false 
});

// Explicitly add indexes as requested
// Unique index on slug to prevent duplicate documents and enable fast lookups
documentSchema.index({ slug: 1 }, { unique: true });

// Text index on title and content for future search APIs
// Using weighted indexes improves ranking. Matches in 'title' are scored 5x higher than 'content'.
documentSchema.index(
  { title: 'text', content: 'text' },
  { weights: { title: 5, content: 1 } }
);

const Document = mongoose.model('Document', documentSchema);

module.exports = Document;
