import create_feed from '/src/db/ops/create-feed.js';
import get_feed from '/src/db/ops/get-feed.js';
import * as resource_utils from '/src/db/resource-utils.js';
import test_open from '/src/db/test-open.js';
import assert from '/src/lib/assert.js';
import * as indexeddb_utils from '/src/lib/indexeddb-utils.js';

export async function get_feed_test() {
  const db_name = 'get-feed-test';
  await indexeddb_utils.remove(db_name);

  const conn = await test_open(db_name);

  const feed = {};
  const url = new URL('a://b.c');
  resource_utils.set_url(feed, url);

  const feed_id = await create_feed(conn, feed);
  assert(resource_utils.is_valid_id(feed_id));
  const stored_feed = await get_feed(conn, 'id', feed_id, false);
  assert(stored_feed);
  const stored_feed2 = await get_feed(conn, 'url', url, false);
  assert(stored_feed2);

  conn.close();
  await indexeddb_utils.remove(db_name);
}
