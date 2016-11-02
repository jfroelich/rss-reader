// See license.md

'use strict';

// TODO: use a test db instead of the real db (and delete at end of test)

async function test_lookup(url_str) {
  const url = new URL(url_str);
  let db_name, db_version;
  try {
    const conn = await favicon_connect(db_name, db_version, console);
    const icon = await favicon_lookup(conn, url, console);
    conn.close();
    console.debug('Result:', icon ? icon.href : 'null');
  } catch(error) {
    console.log(error);
  }
}

async function test_compact() {
  try {
    const conn = await favicon_connect(undefined, undefined, console);
    let num_deleted = await compact_favicons(conn, console);
    conn.close();
  } catch(error) {
    console.debug(error);
  }
}
