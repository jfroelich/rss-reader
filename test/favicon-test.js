
/*
TODO:

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

import FaviconCache from "/src/favicon-cache.js";
import FaviconLookup from "/src/favicon-lookup.js";

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

async function test_clear_icon_db() {
  const cache = new FaviconCache();
  try {
    await cache.open();
    await cache.clear();
  } finally {
    cache.close();
  }
}

async function test_compact_icon_db() {
  const cache = new FaviconCache();
  try {
    await cache.open();
    await cache.compact();
  } finally {
    cache.close();
  }
}
