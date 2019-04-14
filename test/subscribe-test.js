import * as databaseUtils from '/test/database-utils.js';
import * as db from '/src/db/db.js';
import * as indexedDBUtils from '/lib/indexeddb-utils.js';
import { INDEFINITE } from '/lib/deadline.js';
import assert from '/lib/assert.js';
import subscribe from '/src/subscribe.js';

export default async function () {
  const databaseNamePrefix = 'subscribe-test';
  await databaseUtils.removeDatbasesForPrefix(databaseNamePrefix);
  const databaseName = databaseUtils.createUniqueDatabaseName(databaseNamePrefix);

  const conn = await databaseUtils.createTestDatabase(databaseName);

  // Setup subscribe parameters

  const path = '/test/subscribe-test-feed.xml';
  const localURLString = chrome.extension.getURL(path);
  const url = new URL(localURLString);

  let callbackCalled = false;

  function feedStoredCallback() {
    callbackCalled = true;
  }

  let iconn;
  const fetchFeedTimeout = INDEFINITE;
  const notify = false;

  // Rethrow subscribe exceptions just like assertion failures by omitting
  // try/catch.
  const resource = await subscribe(conn, iconn, url, fetchFeedTimeout, notify, feedStoredCallback);

  // subscribe should yield a resource object
  assert(resource && typeof resource === 'object');

  // the produced resource should have the proper type value
  assert(resource.type === 'feed');

  // the produced resource should have a well-formed identifier
  assert(db.isValidId(resource.id));

  // subscribe should have invoked the feed-created callback
  assert(callbackCalled);

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
