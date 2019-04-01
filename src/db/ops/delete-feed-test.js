import create_entry from '/src/db/ops/create-entry.js';
import create_feed from '/src/db/ops/create-feed.js';
import delete_feed from '/src/db/ops/delete-feed.js';
import get_entry from '/src/db/ops/get-entry.js';
import get_feed from '/src/db/ops/get-feed.js';
import * as resource_utils from '/src/db/resource-utils.js';
import test_open from '/src/db/test-open.js';
import assert from '/src/lib/assert.js';
import * as indexeddb_utils from '/src/lib/indexeddb-utils.js';

export async function delete_feed_test() {
  const db_name = 'delete-feed-test';
  await indexeddb_utils.remove(db_name);

  const conn = await test_open(db_name);

  const feed1 = {};
  const url1 = new URL('http://www.example.com/foo.xml');
  resource_utils.set_url(feed1, url1);
  const feed_id1 = await create_feed(conn, feed1);

  const entry = {};
  resource_utils.set_url(entry, new URL('a://b.c'));
  entry.feed = feed_id1;
  const entry_id = await create_entry(conn, entry);

  // Creating the entry should have completed without error and produced a valid
  // id, as a precondition to checking this id no longer exists later.
  assert(entry_id);

  const delete_reason = 'test-reason';
  await delete_feed(conn, feed_id1, delete_reason);

  // Deleting the feed should have deleted the entry. We have a valid entry id,
  // and should no longer be able to find it.
  const matching_entry = await get_entry(conn, 'id', entry_id);
  assert(!matching_entry);

  // TODO: create a second entry, attach it to a second feed, and verify that
  // the entry remains in order to verify that delete-feed did delete the wrong
  // entry

  // Doing these operations should have produced messages that the test channel
  // recorded. The test channel's message log should not be empty.
  assert(conn.channel.messages.length);

  conn.close();
  await indexeddb_utils.remove(db_name);
}

// TODO: resolve conflict with delete_feed_test, note this is not registered in
// the test registry
export async function delete_feed_test2() {
  const db_name = 'delete-feed-test2';
  await indexeddb_utils.remove(db_name);

  const conn = await test_open(db_name);

  const feed1 = {};
  const url1 = new URL('http://www.example.com/foo.xml');
  resource_utils.set_url(feed1, url1);
  const feed_id1 = await create_feed(conn, feed1);

  const feed2 = {};
  const url2 = new URL('http://www.example.com/bar.xml');
  resource_utils.set_url(feed2, url2);
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
