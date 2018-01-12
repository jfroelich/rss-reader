import * as Status from "/src/common/status.js";
import {FaviconCache, FaviconService} from "/src/favicon-service/favicon-service.js";

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

window.testLookup = async function(url, cacheless) {
  const cache = new FaviconCache();
  const query = new FaviconService();
  query.cache = cache;

  const lookupURL = new URL(url);

  let status;
  if(!cacheless) {
    status = await cache.open();
    if(status !== Status.OK) {
      console.error('Failed to open favicon cache:', Status.toString(status));
      return [status];
    }
  }

  let iconURLString;
  [status, iconURLString] = await query.lookup(lookupURL);
  if(status !== Status.OK) {
    console.error('Failed to lookup favicon for url', lookupURL.href, Status.toString(status));
  }

  if(!cacheless) {
    cache.close();
  }

  return [status, iconURLString];
}

window.testClearIconDB = async function() {
  const cache = new FaviconCache();
  let status = await cache.open();
  if(status !== Status.OK) {
    console.error('Failed to open favicon cache:', Status.toString(status));
    return status;
  }

  status = await cache.clear();
  if(status !== Status.OK) {
    console.error('Failed to clear favicon cache:', Status.toString(status));
  }

  cache.close();
  return status;
}

window.testCompactIconDB = async function(limit) {
  const cache = new FaviconCache();
  let status = await cache.open();
  if(status !== Status.OK) {
    console.error('Failed to open favicon cache:', Status.toString(status));
    return status;
  }

  let customMaxAge;
  status = await cache.compact(customMaxAge, limit);
  if(status !== Status.OK) {
    console.error('Failed to compact favicon cache:', Status.toString(status));
  }

  cache.close();
  return status;
}
