const hash = require('object-hash');
const Redis = require('ioredis');
const yn = require('yn');

const podcastFeed = require('../queries/podcastFeed');

let CACHE = {};

if (yn(process.env.ENABLE_CACHING)) {
  CACHE = new Redis({
    port: process.env.REDIS_PORT || 6379, // Redis port
    host: process.env.REDIS_HOST || 'redis', // Redis host
    family: process.env.REDIS_IP_FAMILY || 4,
    password: process.env.REDIS_PASSWORD || null,
    db: process.env.REDIS_DB || 0,
  });

  CACHE.on('error', function(err) {
    console.error('Error connecting to REDIS!');
    console.error('Please check your connection settings!');
    console.error(err);
    console.error('Will exit now...');
    process.exit(1);
  });
}
class CacheHandler {
  setClient(client) {
    this.client = client;
    this.key = hash(client.clientConfig);
  }

  subscribe() {
    console.log('Subscribing to sanity server!');
    this.subscription = this.client.listen(podcastFeed, {}, { includeResult: true }).subscribe(result => {
      //only invalidate cache, when there has been a change of a content
      if (result.result) this.invalidateCache();
    });
  }

  unsubscribe() {
    console.log('Unsubscribing from cache!');
    this.subscription.unsubscribe();
  }

  invalidateCache() {
    console.log('Cache invalidation triggered!');
    CACHE.del(this.key);
  }

  addFeed(feed) {
    console.log(`Adding ${this.key} to cache...`);
    CACHE.set(this.key, feed);
  }

  async isCached() {
    const cached = await CACHE.exists(this.key);
    return cached === 1;
  }

  async getFeed() {
    console.log('Returning feed from cache!');
    const feed = await CACHE.get(this.key);
    return feed;
  }
}

module.exports = new CacheHandler();
