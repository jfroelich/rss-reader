// See license.md

'use strict';

// TODO: this should probably setup and tear down a test cache instead of
// using the real cache by default

async function test_lookup(url_str) {
  let db_target, conn, doc;
  const url = new URL(url_str);
  try {
    const icon = await favicon_lookup(db_target, conn, url, doc, console);
    console.debug('Result:', icon ? icon.href : 'null');
  } catch(error) {
    console.log(error);
  }
}

async function test_compact() {
  let db_target;
  try {
    let num_deleted = await compact_favicons(db_target, console);
  } catch(error) {
    console.debug(error);
  }
}
