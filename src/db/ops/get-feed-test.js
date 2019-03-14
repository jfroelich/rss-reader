import {assert} from '/src/assert.js';
import db_open from '/src/db/ops/db-open.js';
import create_feed from '/src/db/ops/create-feed.js';
import get_feed from '/src/db/ops/get-feed.js';
import {Feed} from '/src/db/types/feed.js';
import * as indexeddb_utils from '/src/indexeddb-utils/indexeddb-utils.js';

export async function get_feed_test() {
  const db_name = 'get-feed-test';
  await indexeddb_utils.remove(db_name);

  const conn = await db_open(db_name);

  const feed = new Feed();
  const url = new URL('a://b.c');
  feed.appendURL(url);
  const feed_id = await create_feed(conn, undefined, feed);
  assert(Feed.isValidId(feed_id));
  const stored_feed = await get_feed(conn, 'id', feed_id, false);
  assert(stored_feed);
  const stored_feed2 = await get_feed(conn, 'url', url, false);
  assert(stored_feed2);

  conn.close();
  await indexeddb_utils.remove(db_name);
}
