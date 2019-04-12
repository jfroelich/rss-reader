import assert from '/lib/assert.js';
import { Deadline, INDEFINITE } from '/lib/deadline.js';
import * as indexedDBUtils from '/lib/indexeddb-utils.js';
import * as db from '/src/db/db.js';
import subscribe from '/src/subscribe.js';
import * as databaseUtils from '/test/database-utils.js';

export async function subscribe_test() {
  const database_name_prefix = 'subscribe-test';
  await databaseUtils.remove_databases_for_prefix(database_name_prefix);
  const database_name =      databaseUtils.create_unique_database_name(database_name_prefix);

  const conn = await databaseUtils.create_test_database(database_name);

  // Setup subscribe parameters

  const path = '/test/subscribe-test-feed.xml';
  const local_url_string = chrome.extension.getURL(path);
  const url = new URL(local_url_string);

  let callback_called = false;
  const feed_stored_callback = function (feed) {
    callback_called = true;
  };


  const iconn;
  const fetchFeedTimeout = INDEFINITE;
  const notify = false;

  // Rethrow subscribe exceptions just like assertion failures by omitting
  // try/catch.
  const resource = await subscribe(
    conn, iconn, url, fetchFeedTimeout, notify, feed_stored_callback
);

  // subscribe should yield a resource object
  assert(resource && typeof resource === 'object');

  // the produced resource should have the proper type value
  assert(resource.type === 'feed');

  // the produced resource should have a well-formed identifier
  assert(db.isValidId(resource.id));

  // subscribe should have invoked the feed-created callback
  assert(callback_called);

  // The created resource should contain one or more urls, including the initial
  // url input to subscribe
  assert(resource.urls.length);
  assert(resource.urls.includes(url.href));

  // subscribing to a new feed should create the resource in the active state
  assert(resource.active === 1);

  // subscribing should have dispatched one or more messages
  assert(conn.channel.messages.length);

  conn.close();
  await indexedDBUtils.remove(conn.conn.name);
}
