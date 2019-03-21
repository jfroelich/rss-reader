import * as identifiable from '/src/db/identifiable.js';
import * as locatable from '/src/db/locatable.js';
import Feed from '/src/db/feed.js';
import create_feed from '/src/db/ops/create-feed.js';
import get_feed from '/src/db/ops/get-feed.js';
import db_open from '/src/db/ops/open.js';
import {is_feed} from '/src/db/types.js';
import assert from '/src/lib/assert.js';
import * as indexeddb_utils from '/src/lib/indexeddb-utils.js';

export async function create_feed_test() {
  const db_name = 'create-feed-test';
  await indexeddb_utils.remove(db_name);

  const conn = await db_open(db_name);

  const feed = new Feed();
  const feed_url = new URL('http://www.example.com/example.rss');
  locatable.append_url(feed, feed_url);

  const stored_feed_id = await create_feed(conn, undefined, feed);
  assert(identifiable.is_valid_id(stored_feed_id));
  let stored_feed = await get_feed(conn, 'url', feed_url, true);
  assert(is_feed(stored_feed));

  stored_feed = await get_feed(conn, 'id', stored_feed_id, false);
  assert(is_feed(stored_feed));

  conn.close();
  await indexeddb_utils.remove(db_name);
}

export async function create_feed_url_constraint_test() {
  const db_name = 'create-feed-url-constraint-test';
  await indexeddb_utils.remove(db_name);

  const conn = await db_open(db_name);

  const feed1 = new Feed();
  locatable.append_url(feed1, new URL('http://www.example.com/example.rss'));
  await create_feed(conn, undefined, feed1);

  const feed2 = new Feed();
  locatable.append_url(feed2, new URL('http://www.example.com/example.rss'));

  let create_error;
  try {
    await create_feed(conn, undefined, feed2);
  } catch (error) {
    create_error = error;
  }

  // Verify that the second attempt to store fails as expected
  assert(create_error instanceof DOMException);

  conn.close();
  await indexeddb_utils.remove(db_name);
}
