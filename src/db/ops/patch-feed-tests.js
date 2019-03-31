import * as locatable from '/src/db/locatable.js';
import create_feed from '/src/db/ops/create-feed.js';
import get_feed from '/src/db/ops/get-feed.js';
import patch_feed from '/src/db/ops/patch-feed.js';
import test_open from '/src/db/test-open.js';
import assert from '/src/lib/assert.js';
import * as indexeddb_utils from '/src/lib/indexeddb-utils.js';

export async function patch_feed_test() {
  const db_name = 'patch-feed-test';
  await indexeddb_utils.remove(db_name);

  const conn = await test_open(db_name);

  let feed = {};
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

export async function activate_feed_test() {
  const db_name = 'activate-feed-test';
  await indexeddb_utils.remove(db_name);

  const conn = await test_open(db_name);

  // Create an inactive feed and store it
  const feed = {};
  feed.active = false;
  locatable.append_url(feed, new URL('a://b.c'));
  const id = await create_feed(conn, feed);

  const created_feed = await get_feed(conn, 'id', id, false);
  assert(!created_feed.active);

  // Run the primary focus of this test. This should succeed without error. This
  // implies quite a lot, including that the feed object was found in the
  // database, that the object was of type feed, and that the feed was not
  // already in the active state.
  await patch_feed(conn, {id: id, active: true});

  // Activating a feed should have produced a single message of a certain type
  assert(conn.channel.messages.length);

  // Read the feed back out of the database to investigate
  const stored_feed = await get_feed(conn, 'id', id, false);
  assert(stored_feed && typeof stored_feed === 'object');

  // Activation should result in the active state
  assert(stored_feed.active === true);

  // Activation should have cleared out any dependent deactivation properties
  assert(stored_feed.deactivation_date === undefined);
  assert(stored_feed.deactivation_reason === undefined);

  // The feed should not have somehow been updated in the future
  const now = new Date();
  assert(stored_feed.updated_date <= now);

  // Activating a feed that is already active should fail
  let activation_error;
  try {
    await patch_feed(conn, {id: id, active: true});
  } catch (error) {
    activation_error = error;
  }
  assert(activation_error);

  // Activating a feed with a well-formed id that does not correspond to an
  // existing feed should fail
  let invalid_id_error = undefined;
  try {
    await patch_feed(conn, {id: 123456789, active: true});
  } catch (error) {
    invalid_id_error = error;
  }
  assert(invalid_id_error);

  conn.close();
  await indexeddb_utils.remove(db_name);
}

export async function deactivate_feed_test() {
  const db_name = 'db-deactivate-feed-test';
  await indexeddb_utils.remove(db_name);

  const conn = await test_open(db_name);

  const feed = {};
  const url = new URL('a://b.c');
  locatable.append_url(feed, url);
  feed.active = true;
  const feed_id = await create_feed(conn, feed);

  await patch_feed(
      conn, {id: feed_id, active: false, deactivation_reason: 'testing'});

  const stored_feed = await get_feed(conn, 'id', feed_id, false);
  assert(stored_feed);
  assert(stored_feed.active === false);
  assert(stored_feed.deactivation_reason === 'testing');
  assert(stored_feed.deactivation_date);
  const now = new Date();
  assert(stored_feed.deactivation_date <= now);

  conn.close();
  await indexeddb_utils.remove(db_name);
}
