// See license.md

'use strict';

/*
TODO:
* Use a test db instead of the real db, and make sure to
delete the test db at the end of the test. openFaviconDb accepts an options
object where I can define name/version, and I can custom code a simple delete
database function
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

async function testLookup(urlString, isCacheless) {
  const url = new URL(urlString);
  let conn, name, version;
  let maxAgeMillis, fetchHTMLTimeoutMillis, fetchImageTimeoutMillis,
    minImageByteSize, maxImageByteSize, connectTimeoutMillis;
  const verbose = true;

  try {
    if(!isCacheless) {
      conn = await openFaviconDb(name, version, connectTimeoutMillis, verbose);
    }
    const iconURLString = await lookupFavicon(conn, url, maxAgeMillis,
      fetchHTMLTimeoutMillis, fetchImageTimeoutMillis, minImageByteSize,
      maxImageByteSize, verbose);
    console.log('lookupFavicon output:', iconURLString);
  } finally {
    if(conn) {
      conn.close();
    }
  }
}

async function testClear() {
  const verbose = true;
  let conn, name, version, timeoutMillis;
  try {
    conn = await openFaviconDb(name, version, timeoutMillis, verbose);
    await clearFaviconDb(conn);
  } catch(error) {
    console.warn(error);
  } finally {
    if(conn) {
      conn.close();
    }
  }
}

async function testCompact() {
  const verbose = true;
  let name, version, maxAgeMillis;
  const numDeleted = await compactFaviconDb(name, version, maxAgeMillis,
    verbose);
  console.log('Deleted %d entries', numDeleted);
}
