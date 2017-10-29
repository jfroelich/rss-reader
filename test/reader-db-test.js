// See license.md

// import base/indexeddb.js
// import base/status.js
// import reader-db.js

// TODO: test timeouts
// TODO: this is out of date. reader_db_open does not accept params
// To test, use indexeddb_open

async function test() {
  console.log('test_db start');

  const name = 'test-feed-db', version = 1;
  let close_requested = false;
  let conn;
  try {
    conn = await indexeddb_open(name, version, reader_db_onupgradeneeded);
    console.assert(indexeddb_is_open(conn));
    indexeddb_close(conn);

    if(indexeddb_is_open(conn)) {
      console.debug('NOT DESIRED: indexeddb_is_open says open after conn closed');
    } else {
      console.debug('DESIRED: indexeddb_is_open says conn closed');
    }

    close_requested = true;
    await indexeddb_delete_database(name);
  } catch(error) {
    console.warn(error);
    return ERR_DB;
  } finally {
    if(!close_requested) {
      indexeddb_close(conn);
      console.assert(!indexeddb_is_open(conn));
    }
  }

  console.log('test_db end');
  return STATUS_OK;
}
