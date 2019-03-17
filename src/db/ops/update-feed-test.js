import {Feed} from '/src/db/object/feed.js';
import create_feed from '/src/db/ops/create-feed.js';
import get_feed from '/src/db/ops/get-feed.js';
import db_open from '/src/db/ops/open.js';
import update_feed from '/src/db/ops/update-feed.js';
import assert from '/src/lib/assert.js';
import * as indexeddb_utils from '/src/lib/indexeddb-utils.js';

export async function update_feed_test() {
  const db_name = 'update-feed-test';
  await indexeddb_utils.remove(db_name);

  const conn = await db_open(db_name);

  let feed = new Feed();
  feed.title = 'first';
  const url = new URL('a://b.c');
  feed.appendURL(url);
  let new_id = await create_feed(conn, undefined, feed);

  feed.id = new_id;
  feed.title = 'second';
  await update_feed(conn, undefined, feed, true);

  feed = undefined;  // paranoia
  feed = await get_feed(conn, 'id', new_id, false);
  assert(feed.title = 'second');

  conn.close();
  await indexeddb_utils.remove(db_name);
}
