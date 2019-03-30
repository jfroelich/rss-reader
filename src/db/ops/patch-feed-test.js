import Feed from '/src/db/feed.js';
import * as locatable from '/src/db/locatable.js';
import create_feed from '/src/db/ops/create-feed.js';
import get_feed from '/src/db/ops/get-feed.js';
import patch_feed from '/src/db/ops/patch-feed.js';
import test_open from '/src/db/test-open.js';
import assert from '/src/lib/assert.js';
import * as indexeddb_utils from '/src/lib/indexeddb-utils.js';

export default async function patch_feed_test() {
  const db_name = 'patch-feed-test';
  await indexeddb_utils.remove(db_name);

  const conn = await test_open(db_name);

  let feed = new Feed();
  feed.title = 'first';
  const url = new URL('a://b.c');
  locatable.append_url(feed, url);

  let new_id = await create_feed(conn, feed);

  await patch_feed(conn, {id: new_id, title: 'second'});

  feed = await get_feed(conn, 'id', new_id, false);
  assert(feed.title = 'second');

  conn.close();
  await indexeddb_utils.remove(db_name);
}
