import {assert} from '/src/assert.js';
import db_open from '/src/db/ops/db-open.js';
import create_feeds from '/src/db/ops/create-feeds.js';
import get_feed from '/src/db/ops/get-feed.js';
import get_feeds from '/src/db/ops/get-feeds.js';
import {Feed, is_feed} from '/src/db/types/feed.js';
import * as indexeddb_utils from '/src/indexeddb-utils/indexeddb-utils.js';

export async function create_feeds_test() {
  const db_name = 'create-feeds-test';
  await indexeddb_utils.remove(db_name);

  const conn = await db_open(db_name);

  const num_feeds = 3, feeds = [];
  for (let i = 0; i < num_feeds; i++) {
    const feed = new Feed();
    feed.appendURL(new URL('a://b.c' + i));
    feeds.push(feed);
  }
  const ids = await create_feeds(conn, undefined, feeds);
  assert(ids.length === num_feeds);

  const stored_feeds = await get_feeds(conn, 'all', false);
  assert(stored_feeds.length === num_feeds);

  const get_proms = ids.map(id => get_feed(conn, 'id', id, false));
  const feeds_by_id = await Promise.all(get_proms);
  for (const feed of feeds_by_id) {
    assert(is_feed(feed));
    assert(Feed.isValidId(feed.id));
  }

  conn.close();
  await indexeddb_utils.remove(db_name);
}
