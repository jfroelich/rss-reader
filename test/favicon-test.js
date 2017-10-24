'use strict';

/*
TODO:

* Use a test db instead of the real db, and make sure to
delete the test db at the end of the test. to use a test db, directly call
indexeddb_open instead of favicon_open_db
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
      query.conn = await favicon_open_db();
    }

    return await favicon_lookup(query);
  } finally {
    if(query.conn)
      query.conn.close();
  }
}

async function test_clear_icon_db() {
  let conn;
  try {
    conn = await favicon_open_db();
    await favicon_db_clear(conn);
  } finally {
    if(conn)
      conn.close();
  }
}

async function test_compact_icon_db() {
  let max_age_ms;
  const num_entries_deleted = await favicon_compact_db(max_age_ms);
  console.log('Deleted %d entries', num_entries_deleted);
}
