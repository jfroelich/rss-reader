import {FaviconService} from '/src/favicon-service/favicon-service.js';
import * as idb from '/src/idb/idb.js';

window.test_lookup = async function(url_string, cached) {
  const url = new URL(url_string);

  const fs = new FaviconService();
  fs.console = console;
  fs.name = 'test-favicon-cache';

  let conn;
  if (cached) {
    console.debug('Lookup is cache enabled');
    conn = await fs.open();
    fs.conn = conn;
  }

  const icon_url_string = await fs.lookup(url);
  if (cached) {
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
};

window.FaviconService = FaviconService;
