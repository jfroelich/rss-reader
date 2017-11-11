'use strict';

// import favicon-cache.js
// import favicon-lookup.js
// import rbl.js

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

async function testLookup(url, is_cacheless) {
  const cache = new FaviconCache();


  const query = new FaviconQuery();
  query.url = new URL(url);

  try {
    if(!is_cacheless) {
      await cache.open();
      query.cache = cache;
    }

    return await faviconLookup(query);
  } finally {
    if(!is_cacheless) {
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
