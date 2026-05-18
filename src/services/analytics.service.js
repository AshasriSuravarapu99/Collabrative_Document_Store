const Document = require('../models/Document');

/**
 * Service to handle heavy analytics operations using MongoDB Aggregation Pipelines.
 * 
 * Aggregation pipelines are incredibly powerful because they offload complex data 
 * transformations, filtering, and groupings to the database engine (C++) rather than 
 * pulling thousands of documents into Node.js (V8) memory and processing them with JS.
 * This is far superior to legacy Map-Reduce in modern MongoDB.
 */

/**
 * Returns the most edited documents based on revision history length.
 */
const getMostEditedDocuments = async (page = 1, limit = 10) => {
  const skip = (page - 1) * limit;

  // Pipeline for most edited documents
  const pipeline = [
    // 1. Filter out documents with only 1 revision to save processing time
    { $match: { 'revision_history.1': { $exists: true } } },
    
    // 2. Project only what we need and dynamically calculate the size of the array
    {
      $project: {
        title: 1,
        slug: 1,
        version: 1,
        updatedAt: '$metadata.updatedAt',
        revisionCount: { $size: '$revision_history' }
      }
    },
    
    // 3. Sort descending by our newly calculated field
    { $sort: { revisionCount: -1 } },
    
    // 4. Pagination
    { $skip: skip },
    { $limit: limit }
  ];

  const results = await Document.aggregate(pipeline);
  
  // Future Optimization Note: 
  // If this analytics dashboard scales, consider storing a 'revisionCount' directly 
  // on the schema and indexing it, rather than computing it on the fly.
  
  return results;
};

/**
 * Returns the most frequently co-occurring pairs of tags.
 */
const getTagCooccurrence = async (page = 1, limit = 10) => {
  const skip = (page - 1) * limit;

  const pipeline = [
    // 1. Only process documents that have at least 2 tags
    { $match: { 'tags.1': { $exists: true } } },
    
    // 2. Pure aggregation logic to generate unique pairs from an array.
    // Instead of doing this in JS, we use $reduce and $map to generate combinatorial pairs per document.
    {
      $project: {
        pairs: {
          $reduce: {
            input: { $range: [0, { $subtract: [{ $size: "$tags" }, 1] }] },
            initialValue: [],
            in: {
              $concatArrays: [
                "$$value",
                {
                  $map: {
                    input: { $range: [{ $add: ["$$this", 1] }, { $size: "$tags" }] },
                    as: "j",
                    in: [
                      { $arrayElemAt: ["$tags", "$$this"] },
                      { $arrayElemAt: ["$tags", "$$j"] }
                    ]
                  }
                }
              ]
            }
          }
        }
      }
    },
    
    // 3. $unwind deconstructs the 'pairs' array so each pair becomes its own document in the pipeline
    { $unwind: "$pairs" },
    
    // 4. Sort the pair elements alphabetically so ["api", "backend"] and ["backend", "api"] group together
    {
      $project: {
        pair: {
          $cond: {
            if: { $lt: [{ $arrayElemAt: ["$pairs", 0] }, { $arrayElemAt: ["$pairs", 1] }] },
            then: "$pairs",
            else: [{ $arrayElemAt: ["$pairs", 1] }, { $arrayElemAt: ["$pairs", 0] }]
          }
        }
      }
    },
    
    // 5. Group by the standardized pair and sum the occurrences
    {
      $group: {
        _id: "$pair",
        count: { $sum: 1 }
      }
    },
    
    // 6. Project cleanly to match required output format
    {
      $project: {
        _id: 0,
        tags: "$_id",
        count: 1
      }
    },
    
    // 7. Sort by highest frequency
    { $sort: { count: -1 } },
    
    // 8. Pagination
    { $skip: skip },
    { $limit: limit }
  ];

  // We explicitly use allowDiskUse: true here. Unwinding combinatorial pairs across
  // millions of documents can quickly consume the 100MB pipeline RAM limit. 
  // allowDiskUse allows MongoDB to write temporary data to disk safely.
  const results = await Document.aggregate(pipeline).allowDiskUse(true);

  return results;
};

module.exports = {
  getMostEditedDocuments,
  getTagCooccurrence
};
