// See license.md

'use strict';

// TODO: use a test db instead of the real db (and delete at end of test)

async function test_lookup(url_str, log) {
  try {
    const url = new URL(url_str);
    const conn = await favicon.connect(undefined, undefined, log);
    const icon = await favicon.lookup(conn, url, log);
    conn.close();
    console.debug('Result:', icon);
  } catch(error) {
    console.log(error);
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
