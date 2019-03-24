import Feed from '/src/db/feed.js';
import * as locatable from '/src/db/locatable.js';
import create_feed from '/src/db/ops/create-feed.js';
import delete_feed from '/src/db/ops/delete-feed.js';
import get_feed from '/src/db/ops/get-feed.js';
import test_open from '/src/db/test-open.js';
import assert from '/src/lib/assert.js';
import * as indexeddb_utils from '/src/lib/indexeddb-utils.js';

export async function delete_feed_test() {
  const db_name = 'delete-feed-test';
  await indexeddb_utils.remove(db_name);

  const conn = await test_open(db_name);

  const feed1 = new Feed();
  const url1 = new URL('http://www.example.com/foo.xml');
  locatable.append_url(feed1, url1);
  const feed_id1 = await create_feed(conn, feed1);

  const delete_reason = 'test-reason';
  await delete_feed(conn, feed_id1, delete_reason);

  assert(conn.channel.messages.length);

  const second_message = conn.channel.messages[1];
  assert(typeof second_message === 'object');
  assert(second_message.type === 'feed-deleted');
  assert(second_message.id === feed_id1);
  assert(second_message.reason === delete_reason);

  conn.close();
  await indexeddb_utils.remove(db_name);
}

// TODO: resolve conflict with delete_feed_test, note this is not registered in
// the test registry
export async function delete_feed_test2() {
  const db_name = 'delete-feed-test2';
  await indexeddb_utils.remove(db_name);

  const conn = await test_open(db_name);

  const feed1 = new Feed();
  const url1 = new URL('http://www.example.com/foo.xml');
  locatable.append_url(feed1, url1);
  const feed_id1 = await create_feed(conn, feed1);

  const feed2 = new Feed();
  const url2 = new URL('http://www.example.com/bar.xml');
  locatable.append_url(feed2, url2);
  const feed_id2 = await create_feed(conn, feed2);

  await delete_feed(conn, feed_id1);

  const stored_feed1 = await get_feed(conn, 'id', feed_id1, false);
  assert(!stored_feed1);
  const stored_feed2 = await get_feed(conn, 'id', feed_id2, false);
  assert(stored_feed2);

  const non_existent_id = 123456789;
  await delete_feed(conn, non_existent_id);
  await delete_feed(conn, feed_id2);

  conn.close();
  await indexeddb_utils.remove(db_name);
}
