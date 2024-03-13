#!/usr/bin/node


import { promisify } from 'util';
import { createClient } from 'redis';

/**
 * Represents a Redis client.
 */
class RedisClient {
  /**
   * Creates a new RedisClient instance.
   */
  constructor() {
    this.client = createClient();
    this.isClientConnected = true;

    // Handle connection events
    this.client.on('error', this.handleError.bind(this));
    this.client.on('connect', this.handleConnect.bind(this));
  }

  /**
   * Handles errors in the Redis client connection.
   * @param {Error} error The error object.
   */
  handleError(error) {
    console.error('Redis client failed to connect:', error.message || error.toString());
    this.isClientConnected = false;
  }

  /**
   * Handles successful connection to the Redis server.
   */
  handleConnect() {
    console.log('Connected to Redis server');
    this.isClientConnected = true;
  }

  /**
   * Checks if this client's connection to the Redis server is active.
   * @returns {boolean}
   */
  isAlive() {
    return this.isClientConnected;
  }

  /**
   * Retrieves the value of a given key.
   * @param {String} key The key of the item to retrieve.
   * @returns {Promise<String | Object>}
   */
  async get(key) {
    const getAsync = promisify(this.client.get).bind(this.client);
    return getAsync(key);
  }

  /**
   * Stores a key and its value along with an expiration time.
   * @param {String} key The key of the item to store.
   * @param {String | Number | Boolean} value The item to store.
   * @param {Number} duration The expiration time of the item in seconds.
   * @returns {Promise<void>}
   */
  async set(key, value, duration) {
    const setexAsync = promisify(this.client.setex).bind(this.client);
    return setexAsync(key, duration, value);
  }

  /**
   * Removes the value of a given key.
   * @param {String} key The key of the item to remove.
   * @returns {Promise<void>}
   */
  async del(key) {
    const delAsync = promisify(this.client.del).bind(this.client);
    return delAsync(key);
  }
}

export const redisClient = new RedisClient();
export default redisClient;
