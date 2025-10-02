import { MongoClient, Db } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://auth:auth@webapp-ireadcustomer.fyywwxu.mongodb.net/irc_platform_prod?retryWrites=true&w=majority&appName=WebApp-iReadCustomer';
const MONGODB_DB = process.env.MONGODB_DB || 'irc_platform_prod';

if (!MONGODB_URI) {
  throw new Error('Please define MONGODB_URI in .env');
}

interface CachedConnection {
  client: MongoClient;
  db: Db;
}

declare global {
  var mongoConnection: CachedConnection | undefined;
}

let cached: CachedConnection | undefined = global.mongoConnection;

if (!cached) {
  cached = global.mongoConnection = undefined;
}

export async function connectToDatabase(): Promise<CachedConnection> {
  if (cached) {
    return cached;
  }

  const client = await MongoClient.connect(MONGODB_URI, {
    maxPoolSize: 10,
    minPoolSize: 5,
  });

  const db = client.db(MONGODB_DB);

  cached = { client, db };
  global.mongoConnection = cached;

  return cached;
}

export async function getDatabase(): Promise<Db> {
  const { db } = await connectToDatabase();
  return db;
}
