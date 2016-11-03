// See license.md

'use strict';

// TODO: use a test db instead of the real db (and delete at end of test)

async function test_lookup(url_str, log = console) {
  try {
    const url = new URL(url_str);
    const conn = await favicon_connect(undefined, undefined, log);
    const icon = await favicon_lookup(conn, url, log);
    conn.close();
    log.debug('Result:', icon ? icon.href : 'null');
  } catch(error) {
    log.log(error);
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
