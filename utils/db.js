#!/usr/bin/node


import mongodb from 'mongodb';
import envLoader from './env_loader';

/**
 * Represents a MongoDB client.
 */
class DBClient {
  /**
   * Creates a new DBClient instance.
   */
  constructor() {
    envLoader();
    const host = process.env.DB_HOST || 'localhost';
    const port = process.env.DB_PORT || 27017;
    const database = process.env.DB_DATABASE || 'files_manager';
    const dbURL = `mongodb://${host}:${port}/${database}`;

    this.client = new mongodb.MongoClient(dbURL, { useUnifiedTopology: true });
    this.connect(); // Connect to MongoDB server
  }

  /**
   * Connects to the MongoDB server.
   */
  async connect() {
    try {
      await this.client.connect();
      console.log('Connected to MongoDB server');
    } catch (error) {
      console.error('Error connecting to MongoDB:', error);
      process.exit(1); // Exit process if unable to connect
    }
  }

  /**
   * Checks if this client's connection to the MongoDB server is active.
   * @returns {boolean}
   */
  isAlive() {
    return this.client.isConnected();
  }

  /**
   * Retrieves the number of documents in a specified collection.
   * @param {string} collectionName Name of the collection.
   * @returns {Promise<number>} Number of documents in the collection.
   */
  async countDocuments(collectionName) {
    try {
      const collection = this.client.db().collection(collectionName);
      return await collection.countDocuments();
    } catch (error) {
      console.error(`Error counting documents in collection '${collectionName}':`, error);
      throw new Error('Failed to count documents in collection');
    }
  }

  /**
   * Retrieves a reference to a specified collection.
   * @param {string} collectionName Name of the collection.
   * @returns {Promise<Collection>} Reference to the collection.
   */
  async getCollection(collectionName) {
    try {
      return this.client.db().collection(collectionName);
    } catch (error) {
      console.error(`Error retrieving collection '${collectionName}':`, error);
      throw new Error('Failed to retrieve collection');
    }
  }
}

export const dbClient = new DBClient();
export default dbClient;
