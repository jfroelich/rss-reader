import * as locatable from '/src/db/locatable.js';
import Feed from '/src/db/object/feed.js';
import create_feed from '/src/db/ops/create-feed.js';
import delete_feed from '/src/db/ops/delete-feed.js';
import get_feed from '/src/db/ops/get-feed.js';
import db_open from '/src/db/ops/open.js';
import assert from '/src/lib/assert.js';
import * as indexeddb_utils from '/src/lib/indexeddb-utils.js';

export async function delete_feed_test() {
  const db_name = 'delete-feed-test';
  await indexeddb_utils.remove(db_name);

  const conn = await db_open(db_name);

  const feed1 = new Feed();
  const url1 = new URL('http://www.example.com/foo.xml');
  locatable.append_url(feed1, url1);
  const feed_id1 = await create_feed(conn, undefined, feed1);

  const messages = [];
  const channel = {};
  channel.name = 'delete-feed-test-channel';
  channel.postMessage = message => messages.push(message);
  channel.close = function() {};

  const delete_reason = 'test-reason';
  await delete_feed(conn, channel, feed_id1, delete_reason);

  assert(messages.length === 1);
  const first_message = messages[0];
  assert(typeof first_message === 'object');
  assert(first_message.type === 'feed-deleted');
  assert(first_message.id === feed_id1);
  assert(first_message.reason === delete_reason);

  channel.close();
  conn.close();
  await indexeddb_utils.remove(db_name);
}

// TODO: resolve conflict with delete_feed_test, note this is not registered in
// the test registry
export async function delete_feed_test2() {
  const db_name = 'delete-feed-test2';
  await indexeddb_utils.remove(db_name);

  const conn = await db_open(db_name);

  const feed1 = new Feed();
  const url1 = new URL('http://www.example.com/foo.xml');
  locatable.append_url(feed1, url1);
  const feed_id1 = await create_feed(conn, undefined, feed1);

  const feed2 = new Feed();
  const url2 = new URL('http://www.example.com/bar.xml');
  locatable.append_url(feed2, url2);
  const feed_id2 = await create_feed(conn, undefined, feed2);

  await delete_feed(conn, undefined, feed_id1);

  const stored_feed1 = await get_feed(conn, 'id', feed_id1, false);
  assert(!stored_feed1);
  const stored_feed2 = await get_feed(conn, 'id', feed_id2, false);
  assert(stored_feed2);

  const non_existent_id = 123456789;
  await delete_feed(conn, undefined, non_existent_id);
  await delete_feed(conn, undefined, feed_id2);

  conn.close();
  await indexeddb_utils.remove(db_name);
}
