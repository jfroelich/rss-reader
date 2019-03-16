import {assert} from '/src/assert.js';
import db_open from '/src/db/ops/db-open.js';
import create_feed from '/src/db/ops/create-feed.js';
import get_feed_ids from '/src/db/ops/get-feed-ids.js';
import {Feed} from '/src/db/types/feed.js';
import * as indexeddb_utils from '/src/indexeddb-utils/indexeddb-utils.js';

export async function get_feed_ids_test() {
  const db_name = 'get-feed-ids-test';
  await indexeddb_utils.remove(db_name);

  const conn = await db_open(db_name);

  const n = 5;
  const create_promises = [];
  for (let i = 0; i < n; i++) {
    const feed = new Feed();
    const url = new URL('a://b.c/feed' + i + '.xml');
    feed.appendURL(url);
    create_promises.push(create_feed(conn, undefined, feed));
  }

  const created_feed_ids = await Promise.all(create_promises);
  const feed_ids = await get_feed_ids(conn);
  assert(feed_ids.length === created_feed_ids.length);
  for (const id of created_feed_ids) {
    assert(feed_ids.includes(id));
  }

  conn.close();
  await indexeddb_utils.remove(db_name);
}