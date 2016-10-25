// See license.md

'use strict';

// TODO: this should probably setup and tear down a test cache instead of
// using the real cache by default

async function test(url_str) {
  let db_target, conn, doc;
  const url = new URL(url_str);
  try {
    const icon = await favicon_lookup(db_target, conn, url, doc, console);
    console.debug('Result:', icon ? icon.href : 'null');
  } catch(error) {
    console.log(error);
  }
}
