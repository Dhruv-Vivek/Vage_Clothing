import 'server-only';

/**
 * Backend-only MongoDB connection and collection setup for product intelligence; this is NoSQL, not embedded MySQL.
 * See backend/README.md for the database/backend walkthrough.
 */

import { MongoClient } from 'mongodb';

const globalForMongo = globalThis;
const INDEXES = [
  { key: { eventId: 1 }, name: 'uq_product_events_event_id', unique: true },
  { key: { createdAt: -1 }, name: 'idx_product_events_created_at' },
  { key: { eventType: 1, createdAt: -1 }, name: 'idx_product_events_type_created' },
  { key: { productId: 1, eventType: 1, createdAt: -1 }, name: 'idx_product_events_product_type_created' },
  { key: { categoryId: 1, createdAt: -1 }, name: 'idx_product_events_category_created' },
  { key: { searchTerm: 1, createdAt: -1 }, name: 'idx_product_events_search_created' },
  { key: { visitorKey: 1, createdAt: -1 }, name: 'idx_product_events_visitor_created' },
];

function getMongoUri() {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri || /replace_with|your_mongodb_uri/i.test(uri)) return null;
  return uri;
}

export function isProductIntelligenceEnabled() {
  return process.env.PRODUCT_INTELLIGENCE_ENABLED !== 'false' && Boolean(getMongoUri());
}

export async function getProductEventsCollection() {
  const uri = getMongoUri();
  if (!uri || process.env.PRODUCT_INTELLIGENCE_ENABLED === 'false') {
    throw new Error('MongoDB product intelligence is not configured. Set MONGODB_URI and PRODUCT_INTELLIGENCE_ENABLED=true in .env.local.');
  }

  if (!globalForMongo.__vageMongoClientPromise) {
    const client = new MongoClient(uri, {
      appName: 'VAGE-Product-Intelligence',
      maxPoolSize: 10,
      minPoolSize: 0,
      serverSelectionTimeoutMS: 7000,
      connectTimeoutMS: 7000,
    });
    globalForMongo.__vageMongoClientPromise = client.connect().catch((error) => {
      globalForMongo.__vageMongoClientPromise = null;
      throw error;
    });
  }

  const client = await globalForMongo.__vageMongoClientPromise;
  const dbName = (process.env.MONGODB_DATABASE || 'vage_product_intelligence').trim();
  const collection = client.db(dbName).collection('product_events');

  if (!globalForMongo.__vageProductEventIndexesPromise) {
    globalForMongo.__vageProductEventIndexesPromise = collection.createIndexes(INDEXES).catch((error) => {
      globalForMongo.__vageProductEventIndexesPromise = null;
      throw error;
    });
  }
  await globalForMongo.__vageProductEventIndexesPromise;

  return collection;
}

export const PRODUCT_EVENT_INDEXES = INDEXES;
