'use strict';

// import rbl.js
// import favicon.js


/*
TODO:

* Use a test db instead of the real db, and make sure to
delete the test db at the end of the test. to use a test db, directly call
rbl.openDB instead of faviconDbOpen
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

async function test_favicon_lookup(url, is_cacheless) {

  const query = new FaviconQuery();
  query.url = new URL(url);

  try {
    if(!is_cacheless) {
      query.conn = await faviconDbOpen();
    }

    return await faviconLookup(query);
  } finally {
    rbl.closeDB(query.conn);
  }
}

async function test_clear_icon_db() {
  let conn;
  try {
    conn = await faviconDbOpen();
    await faviconDbClear(conn);
  } finally {
    rbl.closeDB(conn);
  }
}

async function test_compact_icon_db() {
  // TODO: i think this is outdated, I think it needs conn now right?
  await faviconCompactDb();
}
