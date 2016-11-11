// See license.md

'use strict';

// TODO: use a test db instead of the real db (and delete at end of test)

async function test_lookup(url_str, log) {
  const url = new URL(url_str);
  let conn;
  try {
    conn = await Favicon.connect();
    const icon = await Favicon.lookup(conn, url, log);
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
    const conn = await Favicon.connect();
    let num_deleted = await Favicon.compact(conn, console);
    conn.close();
  } catch(error) {
    console.debug(error);
  }
}
