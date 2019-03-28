import Feed from '/src/db/feed.js';
import * as locatable from '/src/db/locatable.js';
import create_feed from '/src/db/ops/create-feed.js';
import deactivate_feed from '/src/db/ops/deactivate-feed.js';
import get_feed from '/src/db/ops/get-feed.js';
import test_open from '/src/db/test-open.js';
import {is_feed} from '/src/db/types.js';
import assert from '/src/lib/assert.js';
import * as indexeddb_utils from '/src/lib/indexeddb-utils.js';

export async function deactivate_feed_test() {
  const db_name = 'db-deactivate-feed-test';
  await indexeddb_utils.remove(db_name);

  const conn = await test_open(db_name);

  const feed = new Feed();
  const url = new URL('a://b.c');
  locatable.append_url(feed, url);
  feed.active = true;
  const feed_id = await create_feed(conn, feed);

  await deactivate_feed(conn, feed_id, 'testing');

  const stored_feed = await get_feed(conn, 'id', feed_id, false);
  assert(stored_feed);
  assert(is_feed(stored_feed));
  assert(stored_feed.active === false);
  assert(stored_feed.deactivation_date);
  const now = new Date();
  assert(stored_feed.deactivation_date <= now);

  conn.close();
  await indexeddb_utils.remove(db_name);
}
