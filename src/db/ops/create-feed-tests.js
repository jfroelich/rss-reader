import * as locatable from '/src/db/locatable.js';
import create_feed from '/src/db/ops/create-feed.js';
import get_feed from '/src/db/ops/get-feed.js';
import * as resource_utils from '/src/db/resource-utils.js';
import test_open from '/src/db/test-open.js';
import assert, {AssertionError} from '/src/lib/assert.js';
import * as indexeddb_utils from '/src/lib/indexeddb-utils.js';

export async function create_feed_test() {
  const db_name = 'create-feed-test';
  await indexeddb_utils.remove(db_name);

  const conn = await test_open(db_name);

  const feed = {};
  const feed_url = new URL('http://www.example.com/example.rss');
  locatable.append_url(feed, feed_url);

  const stored_feed_id = await create_feed(conn, feed);
  assert(resource_utils.is_valid_id(stored_feed_id));

  // The new feed should be findable by url
  let stored_feed = await get_feed(conn, 'url', feed_url, true);
  assert(stored_feed);

  // The new feed should be findable by id
  stored_feed = await get_feed(conn, 'id', stored_feed_id, false);
  assert(stored_feed);

  conn.close();
  await indexeddb_utils.remove(db_name);
}

export async function create_feed_without_channel_test() {
  const db_name = 'create-feed-without-channel-test';
  await indexeddb_utils.remove(db_name);

  const conn = await test_open(db_name);

  // create-feed should proceed without error even in the absence of channel
  delete conn.channel;

  let feed = {};
  locatable.append_url(feed, new URL('a://b.c'));

  // Any error here is test failure
  await create_feed(conn, feed);

  conn.close();
  await indexeddb_utils.remove(db_name);
}

export async function create_invalid_feed_test() {
  const db_name = 'create-invalid-feed-test';
  await indexeddb_utils.remove(db_name);

  const conn = await test_open(db_name);

  // Creating a feed without a url should fail with an assertion error.
  let feed = {};
  feed.urls = [];
  let expected_error = undefined;
  try {
    await create_feed(conn, feed);
  } catch (error) {
    expected_error = error;
  }

  assert(expected_error instanceof AssertionError);

  // Calling create-feed on a non feed object should fail with an assertion
  // error
  feed = {};
  expected_error = undefined;
  try {
    await create_feed(conn, feed);
  } catch (error) {
    expected_error = error;
  }
  assert(expected_error instanceof AssertionError);

  // Creating a feed with an explicit id should fail
  feed = {};
  feed.id = 5;
  locatable.append_url(feed, new URL('a://b.c'));
  expected_error = undefined;
  try {
    await create_feed(conn, feed);
  } catch (error) {
    expected_error = error;
  }
  assert(expected_error instanceof AssertionError);

  conn.close();
  await indexeddb_utils.remove(db_name);
}

export async function create_duplicate_url_feed_test() {
  const db_name = 'create-feed-url-constraint-test';
  await indexeddb_utils.remove(db_name);

  const conn = await test_open(db_name);

  const feed1 = {};
  locatable.append_url(feed1, new URL('http://www.example.com/example.rss'));
  await create_feed(conn, feed1);

  const feed2 = {};
  locatable.append_url(feed2, new URL('http://www.example.com/example.rss'));

  let create_error;
  try {
    await create_feed(conn, feed2);
  } catch (error) {
    create_error = error;
  }

  // Verify that the second attempt to store fails as expected. create-feed
  // relies on the unique constraint of the urls index to produce an error.
  assert(create_error instanceof DOMException);

  conn.close();
  await indexeddb_utils.remove(db_name);
}
