import create_feeds from '/src/db/ops/create-feeds.js';
import get_feed from '/src/db/ops/get-feed.js';
import get_feeds from '/src/db/ops/get-feeds.js';
import * as resource_utils from '/src/db/resource-utils.js';
import test_open from '/src/db/test-open.js';
import assert from '/src/lib/assert.js';
import * as indexeddb_utils from '/src/lib/indexeddb-utils.js';

export async function create_feeds_test() {
  const db_name = 'create-feeds-test';
  await indexeddb_utils.remove(db_name);

  const conn = await test_open(db_name);

  const num_feeds = 3, feeds = [];
  for (let i = 0; i < num_feeds; i++) {
    const feed = {};
    resource_utils.set_url(feed, new URL('a://b.c' + i));
    feeds.push(feed);
  }
  const ids = await create_feeds(conn, feeds);
  assert(ids.length === num_feeds);

  const stored_feeds = await get_feeds(conn, 'all', false);
  assert(stored_feeds.length === num_feeds);

  const get_proms = ids.map(id => get_feed(conn, 'id', id, false));
  const feeds_by_id = await Promise.all(get_proms);
  for (const feed of feeds_by_id) {
    assert(resource_utils.is_valid_id(feed.id));
  }

  conn.close();
  await indexeddb_utils.remove(db_name);
}
