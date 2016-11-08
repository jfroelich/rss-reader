// See license.md

'use strict';

// TODO: use a test db instead of the real db (and delete at end of test)

async function test_lookup(url_str, log) {
  const url = new URL(url_str);
  let conn;
  try {
    conn = await favicon.connect(undefined, undefined, log);
    const icon = await favicon.lookup(conn, url, log);
    console.debug('Result:', icon);
  } catch(error) {
    console.log(error);
  } finally {
    if(conn)
      conn.close();
  }
}

async function test_compact() {
  try {
    const conn = await favicon.connect(undefined, undefined, console);
    let num_deleted = await favicon.compact(conn, console);
    conn.close();
  } catch(error) {
    console.debug(error);
  }
}
