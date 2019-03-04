import * as ops from '/src/control/ops.js';
import {assert} from '/src/lib/assert.js';
import * as indexeddb_utils from '/src/lib/indexeddb-utils.js';
import {Feed, is_feed} from '/src/model/feed.js';
import {Model} from '/src/model/model.js';

export async function activate_feed_test() {
  const db_name = 'ops-activate-feed-test';
  await indexeddb_utils.remove(db_name);

  const session = new Model();
  session.name = db_name;
  await session.open();

  // Setup a fake channel for recording messages for later assertions. Do not
  // immediately attach it to the session because we want to ignore certain
  // calls that broadcast messages.
  const messages = [];
  const channel = {};
  channel.postMessage = message => messages.push(message);

  // Create an inactive feed and store it
  const feed = new Feed();
  feed.active = false;
  feed.appendURL(new URL('a://b.c'));
  const id = await session.createFeed(feed);

  // Now attach the channel. We wait until now to skip over create-feed
  session.channel = channel;

  // Run the primary focus of this test. This should succeed without error. This
  // implies quite a lot, including that the feed object was found in the
  // database, that the object was of type feed, and that the feed was not
  // already in the active state.
  await ops.activate_feed(session, id);

  // Detach the channel. Just rules out any chance of awkwardness with out of
  // order execution in this test
  session.channel = undefined;

  // Activating a feed should have produced a single message of a certain type
  assert(messages.length === 1);
  assert(messages[0].type === 'feed-updated');

  // Read the feed back out of the database to investigate
  const stored_feed = await session.getFeed('id', id, false);

  // Activation should not have somehow destroyed type info. For performance
  // reasons this check is NOT implicit in the getFeed call, so it is not
  // redundant or unreasonable to check here
  assert(is_feed(stored_feed));

  // Activation should result in the active state
  assert(stored_feed.active === true);

  // Activation should have cleared out any dependent deactivation properties
  assert(stored_feed.deactivateDate === undefined);
  assert(stored_feed.deactivationReasonText === undefined);

  // The feed should not have somehow been updated in the future
  const now = new Date();
  assert(stored_feed.dateUpdated <= now);

  // Activating a feed that is already active should fail
  let activation_error;
  try {
    await ops.activate_feed(session, id);
  } catch (error) {
    activation_error = error;
  }
  assert(activation_error);

  // Activating a feed that does not exist should fail. There is some subtle
  // complexity here because we need to test against a feed identifier that at
  // minimum appears to be a real feed identifier. There are implicit checks for
  // invalid feed ids (e.g. anything less than 1), and we don't want to trigger
  // those errors, we want to trigger only the error that occurs as a result of
  // searching the object store and not finding something.
  const fake_feed_id = 123456789;
  activation_error = undefined;
  try {
    await ops.activate_feed(session, fake_feed_id);
  } catch (error) {
    activation_error = error;
  }
  assert(activation_error);

  session.close();
  await indexeddb_utils.remove(db_name);
}

export async function deactivate_feed_test() {
  const db_name = 'ops-deactivate-feed-test';
  await indexeddb_utils.remove(db_name);

  const session = new Model();
  session.name = db_name;
  await session.open();

  const feed = new Feed();
  const url = new URL('a://b.c');
  feed.appendURL(url);
  feed.active = true;
  const feed_id = await session.createFeed(feed);
  session.channel.close();

  const messages = [];
  const channel = {};
  channel.postMessage = message => messages.push(message);
  channel.close = function() {};
  session.channel = channel;
  await ops.deactivate_feed(session, feed_id, 'testing');
  const stored_feed = await session.getFeed('id', feed_id, false);
  assert(stored_feed);
  assert(is_feed(stored_feed));
  assert(stored_feed.active === false);
  assert(stored_feed.deactivateDate);
  const now = new Date();
  assert(stored_feed.deactivateDate <= now);
  session.close();
  await indexeddb_utils.remove(db_name);
}

export async function import_opml_test() {
  // TODO: inline
  function create_opml_file(name, text) {
    const file = new Blob([text], {type: 'application/xml'});
    file.name = name;
    return file;
  }

  const db_name = 'ops-import-opml-test';
  await indexeddb_utils.remove(db_name);

  const session = new Model();
  session.name = db_name;
  await session.open();

  let iconn = undefined;  // test without favicon caching support
  const messages = [];

  // Close the channel automatically opened in session.open
  session.channel.close();

  // Provide a new mocked channel
  session.channel = {
    name: 'import-opml-test',
    postMessage: message => messages.push(message),
    close: function() {}
  };

  const opml_string = '<opml version="2.0"><body><outline type="feed" ' +
      'xmlUrl="a://b/c"/></body></opml>';
  const file = create_opml_file('file.xml', opml_string);

  const files = [file];
  const results = await ops.opml_import(session, files);
  assert(results);
  assert(results.length === 1);
  assert(Feed.isValidId(results[0]));

  assert(messages.length === 1);
  assert(messages[0].type === 'feed-created');
  assert(messages[0].id === 1);

  session.close();
  await indexeddb_utils.remove(db_name);
}

export async function subscribe_test() {
  const db_name = 'subscribe-test';
  await indexeddb_utils.remove(db_name);

  const session = new Model();
  session.name = db_name;
  await session.open();

  session.channel.close();

  // Inject a fake channel
  const messages = [];
  session.channel = {
    name: 'channel-stub',
    postMessage: message => messages.push(message),
    close: function() {}
  };

  // TODO: use a local url. First, this url no longer is valid because Google
  // discontinued this service. Second, it is bad practice to ping live
  // third-party services and may be a TOS violation of those services. Third,
  // there is little benefit to exercising the network failure case.

  const test_url = 'https://news.google.com/news/rss/?ned=us&gl=US&hl=en';
  const url = new URL(test_url);

  // Rethrow subscribe exceptions just like assertion failures by omitting
  // try/catch.
  const feed = await ops.subscribe(session, undefined, url, 7000, false);

  // Test the subscription produced the desired result
  assert(feed);
  assert(is_feed(feed));
  assert(Feed.isValidId(feed.id));

  // Length may be 1 or 2 (may have redirected and captured new url)
  assert(feed.urls.length);
  assert(feed.urls.includes(url.href));
  assert(feed.active);

  // Assert that the subscription sent out correct messages
  assert(messages.length === 1);
  assert(messages[0].type === 'feed-created');
  assert(messages[0].id === feed.id);

  session.close();
  await indexeddb_utils.remove(db_name);
}
