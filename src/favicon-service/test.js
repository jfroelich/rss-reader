import * as favicon_service from '/src/favicon-service/favicon-service.js';
import {idb_remove} from '/src/idb/idb.js';

window.test_lookup = async function(url, cached) {
  const test_db_name = 'test-favicon-cache';

  const query = {};
  query.url = new URL(url);
  if (cached) {
    query.conn = await favicon_service.open(test_db_name);
  }

  const icon_url_string = await favicon_service.lookup(query);
  if (cached) {
    query.conn.close();

    await db_remove(query.conn.name);
  }

  return icon_url_string;
};

window.test_compact = favicon_service.compact;
window.test_clear = favicon_service.clear;
