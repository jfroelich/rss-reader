import * as identifiable from '/src/db/identifiable.js';
import * as locatable from '/src/db/locatable.js';
import Feed from '/src/db/feed.js';
import create_feed from '/src/db/ops/create-feed.js';
import get_feed from '/src/db/ops/get-feed.js';
import db_open from '/src/db/ops/open.js';
import assert from '/src/lib/assert.js';
import * as indexeddb_utils from '/src/lib/indexeddb-utils.js';

export async function get_feed_test() {
  const db_name = 'get-feed-test';
  await indexeddb_utils.remove(db_name);

  const conn = await db_open(db_name);

  const feed = new Feed();
  const url = new URL('a://b.c');
  locatable.append_url(feed, url);

  const feed_id = await create_feed(conn, undefined, feed);
  assert(identifiable.is_valid_id(feed_id));
  const stored_feed = await get_feed(conn, 'id', feed_id, false);
  assert(stored_feed);
  const stored_feed2 = await get_feed(conn, 'url', url, false);
  assert(stored_feed2);

  conn.close();
  await indexeddb_utils.remove(db_name);
}
