import {FaviconService} from '/src/favicon-service/favicon-service.js';
import * as idb from '/src/lib/idb/idb.js';

async function test_lookup(url_string, cached) {
  const fs = new FaviconService();
  fs.console = console;
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
    await idb.idb_remove(conn.name);
    console.debug('Deleted database', conn.name);
  }

  return icon_url_string;
}

window.test_lookup = test_lookup;
window.FaviconService = FaviconService;
