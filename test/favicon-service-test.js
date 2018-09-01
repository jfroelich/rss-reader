import {FaviconService} from '/src/iconsvc/favicon-service.js';
import assert from '/src/lib/assert.js';
import * as indexeddb from '/src/lib/indexeddb.js';
import {register_test} from '/test/test-registry.js';

// TODO: this needs to be implemented using local files
// TODO: this needs to be implemented without parameters, it must run on a
// preset url
// TODO: there should be a cached test, and an uncached test

async function favicon_service_test() {
  return true;
}

register_test(favicon_service_test);


/*
async function test_lookup(url_string, cached) {
  const fs = new FaviconService();
  fs.name = 'test-favicon-cache';

  let conn;
  if (cached) {
    console.debug('Lookup is cache enabled');
    conn = await fs.open();
    fs.conn = conn;
  }

  const url = new URL(url_string);
  const icon_url_string = await fs.lookup(url);

  if (cached) {
    // Loosely check if cache hit occurred
    if (icon_url_string) {
      const lookup2 = await fs.lookup(url);
      console.debug('Second lookup result', lookup2);
    }

    console.debug('Requesting closure of database', conn.name);
    conn.close();
    console.debug('Deleting database', conn.name);
    await indexeddb.remove(conn.name);
    console.debug('Deleted database', conn.name);
  }

  return icon_url_string;
}
*/
