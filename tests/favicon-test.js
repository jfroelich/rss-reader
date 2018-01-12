import FaviconCache from "/src/favicon/cache.js";
import FaviconLookup from "/src/favicon/lookup.js";

/*
TODO:

In order to use a test db, I should create helpers for each test, like a helper to
create and connect to test db


* Use a test db instead of the real db, and make sure to
delete the test db at the end of the test.
* to use a test db, set cache.name to a non-default name
* actually run tests instead of command line
* test offline
* test a non-existent host
* test a known host with origin /favicon.ico
* test a known host with <link> favicon
* test a non-expired cached input url
* test a non-expired cached redirect url
* test a non-expired cached origin url
* same as above 3 but expired
* test against icon with byte size out of bounds
* test cacheless versus caching?
* test compact
*/

async function testLookup(url, cacheless) {
  const cache = new FaviconCache();
  const query = new FaviconLookup();
  query.cache = cache;

  const lookupURL = new URL(url);

  try {
    if(!cacheless) {
      await cache.open();
    }

    return await query.lookup(lookupURL);
  } finally {
    if(!cacheless) {
      cache.close();
    }
  }
}

// Expose to console
window.testLookup = testLookup;


async function test_clear_icon_db() {
  const cache = new FaviconCache();
  let status = await cache.open();
  if(status !== Status.OK) {
    console.error('Failed to open favicon cache with status', status);
    return;
  }

  status = await cache.clear();
  if(status !== Status.OK) {
    console.error('Failed to clear favicon cache with status', status);
    cache.close();
    return;
  }

  return cache.close();
}

async function test_compact_icon_db(limit) {

  let customMaxAge;

  const cache = new FaviconCache();
  try {
    await cache.open();
    const status = await cache.compact(customMaxAge, limit);
    if(status !== Status.OK) {
      throw new Error('Failed to compact with status ' + status);
    }
  } finally {
    cache.close();
  }
}
