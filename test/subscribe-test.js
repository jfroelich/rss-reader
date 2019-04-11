import assert from '/lib/assert.js';
import {Deadline, INDEFINITE} from '/lib/deadline.js';
import * as indexeddb_utils from '/lib/indexeddb-utils.js';
import * as db from '/src/db/db.js';
import subscribe from '/src/subscribe.js';
import * as database_utils from '/test/database-utils.js';

export async function subscribe_test() {
  const db_name = 'subscribe-test';
  await indexeddb_utils.remove(db_name);

  const conn = await database_utils.create_test_database(db_name);

  const path = '/test/subscribe-test-feed.xml';
  const local_url_string = chrome.extension.getURL(path);
  const url = new URL(local_url_string);

  let callback_called = false;
  const feed_stored_callback = function(feed) {
    callback_called = true;
  };

  // Setup subscribe parameters
  let iconn = undefined;
  const fetch_feed_timeout = INDEFINITE;
  const notify = false;

  // Rethrow subscribe exceptions just like assertion failures by omitting
  // try/catch.
  const feed = await subscribe(
      conn, iconn, url, fetch_feed_timeout, notify, feed_stored_callback);

  // Test the subscription produced the desired result
  assert(feed && typeof feed === 'object');
  assert(db.is_valid_id(feed.id));

  // subscribe should have invoked the callback
  assert(callback_called);

  // Length may be 1 or 2 (may have redirected and captured new url)
  assert(feed.urls.length);
  assert(feed.urls.includes(url.href));

  assert(feed.active === 1);

  // Assert that the subscription dispatched messages
  assert(conn.channel.messages.length);

  conn.close();
  await indexeddb_utils.remove(db_name);
}
