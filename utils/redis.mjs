import * as redis from 'redis';
import { promisify } from 'util';

class RedisClient {
  constructor() {
    this.client = redis.createClient();
    this.client.on('error', (err) => {
      console.error('Redis Client Error:', err);
    });

    this.getAsync = promisify(this.client.get).bind(this.client);
    this.setAsync = promisify(this.client.set).bind(this.client);
    this.setexAsync = typeof this.client.setex === 'function'
      ? promisify(this.client.setex).bind(this.client)
      : null;
    this.delAsync = promisify(this.client.del).bind(this.client);
  }

  isAlive() {
    return Boolean(this.client && (this.client.connected || this.client.isOpen));
  }

  async get(key) {
    return this.getAsync(key);
  }

  async set(key, value, duration) {
    if (this.setexAsync) {
      await this.setexAsync(key, duration, value);
    } else {
      await this.setAsync(key, value, 'EX', duration);
    }
  }

  async del(key) {
    await this.delAsync(key);
  }
}

const redisClient = new RedisClient();
export default redisClient;
