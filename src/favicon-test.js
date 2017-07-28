// See license.md

'use strict';

/*
TODO:
* Use a test db instead of the real db, and make sure to
delete the test db at the end of the test. openFaviconDb accepts an options
object where I can define name/version, and I can custom code a simple delete
database function
* Implement testing code that actually runs tests instead of just lets me
easily run from the command line
*/


async function testLookup(urlString, isCacheless) {
  const url = new URL(urlString);
  let conn, name, version;
  let maxAgeMillis, fetchHTMLTimeoutMillis, fetchImageTimeoutMillis,
    minImageByteSize, maxImageByteSize;
  const verbose = true;

  try {
    if(!isCacheless) {
      conn = await openFaviconDb(name, version, verbose);
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
  let conn, name, version;
  try {
    conn = await openFaviconDb(name, version, verbose);
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
