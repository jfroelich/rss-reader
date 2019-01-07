import assert from '/src/assert.js';
import * as cdb from '/src/cdb.js';
import * as idb from '/src/idb.js';
import * as ops from '/src/ops.js';

export async function activate_feed_test() {
  const db_name = 'ops-activate-feed-test';

  // I am not using try/finally to ensure the database is removed at the end of
  // the test when an exception occurs. It leaves the database as existing,
  // which then causes ripple effect errors here when reusing the existing
  // database. So just delete the database if it exists first to avoid the
  // headache.
  await idb.remove(db_name);

  const session = await cdb.open(db_name);

  // Setup a fake channel for recording messages for later assertions. Do not
  // immediately attach it to the session because we want to ignore certain
  // calls that broadcast messages.
  const messages = [];
  const channel = {};
  channel.postMessage = message => messages.push(message);

  // Create an inactive feed and store it
  const feed = cdb.construct_feed();
  feed.active = false;
  cdb.append_feed_url(feed, new URL('a://b.c'));
  const id = await cdb.create_feed(session, feed);

  // Now attach the channel. We wait until now to skip over create-feed
  session.channel = channel;

  // Run the primary focus of this test. This should succeed without error. This
  // implies quite a lot, including that the feed object was found in the
  // database, that the object was of type feed, and that the feed was not
  // already in the active state.
  await ops.activate_feed(session, id);

  // Detach the channel. Just rules out any chance of awkwardness with out of
  // order execution in this test.
  session.channel = undefined;

  // Activating a feed should have produced a single message of a certain type
  assert(messages.length === 1);
  assert(messages[0].type === 'feed-updated');

  // Read the feed back out of the database to investigate
  const stored_feed = await cdb.get_feed(session, 'id', id, false);

  // Activation should not have somehow destroyed type info. For performance
  // reasons this check is NOT implicit in the db.get_feed call, so it is not
  // redundant or unreasonable to check here.
  assert(cdb.is_feed(stored_feed));

  // Activation should result in the active state
  assert(stored_feed.active === true);

  // Activation should have cleared out any dependent deactivation properties
  assert(stored_feed.deactivateDate === undefined);
  assert(stored_feed.deactivationReasonText === undefined);

  // The feed should not have somehow been updated in the future
  const now = new Date();
  assert(stored_feed.dateUpdated <= now);

  // Assert that activating a feed that is already active should fail.
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
  const fictitious_feed_id = 123456789;
  activation_error = undefined;
  try {
    await ops.activate_feed(session, fictitious_feed_id);
  } catch (error) {
    activation_error = error;
  }
  assert(activation_error);

  // Test teardown
  session.close();
  await idb.remove(db_name);
}

export async function deactivate_feed_test() {
  const db_name = 'ops-deactivate-feed-test';
  await idb.remove(db_name);
  const session = await cdb.open(db_name);
  const feed = cdb.construct_feed();
  const url = new URL('a://b.c');
  cdb.append_feed_url(feed, url);
  feed.active = true;
  const feed_id = await cdb.create_feed(session, feed);
  session.channel.close();

  const messages = [];
  const channel = {};
  channel.postMessage = message => messages.push(message);
  channel.close = function() {};
  session.channel = channel;
  await ops.deactivate_feed(session, feed_id, 'testing');
  const stored_feed = await cdb.get_feed(session, 'id', feed_id, false);
  assert(stored_feed);
  assert(cdb.is_feed(stored_feed));
  assert(stored_feed.active === false);
  assert(stored_feed.deactivateDate);
  const now = new Date();
  assert(stored_feed.deactivateDate <= now);
  session.close();
  await idb.remove(db_name);
}

export async function import_opml_test() {
  function noop() {}

  function create_opml_file(name, text) {
    const file = new Blob([text], {type: 'application/xml'});
    file.name = name;
    return file;
  }

  const db_name = 'ops-import-opml-test';
  await idb.remove(db_name);
  const session = await cdb.open(db_name);
  let iconn = undefined;  // test without favicon caching support
  const messages = [];

  // Close the channel automatically opened before replacing it
  session.channel.close();

  // Define a new channel
  session.channel = {
    name: 'import-opml-test',
    postMessage: message => messages.push(message),
    close: noop
  };

  const opml_string = '<opml version="2.0"><body><outline type="feed" ' +
      'xmlUrl="a://b/c"/></body></opml>';
  const file = create_opml_file('file.xml', opml_string);

  const files = [file];
  const results = await ops.opml_import(session, files);
  assert(results);
  assert(results.length === 1);
  assert(cdb.is_valid_feed_id(results[0]));

  assert(messages.length === 1);
  assert(messages[0].type === 'feed-created');
  assert(messages[0].id === 1);

  session.close();
  await idb.remove(db_name);
}

export async function subscribe_test() {
  function noop() {}
  // Test setup
  const db_name = 'subscribe-test';
  await idb.remove(db_name);
  const session = await cdb.open(db_name);

  // Inject a fake channel
  const messages = [];
  session.channel = {
    name: 'channel-stub',
    postMessage: message => messages.push(message),
    close: noop
  };

  const test_url = 'https://news.google.com/news/rss/?ned=us&gl=US&hl=en';
  const url = new URL(test_url);

  // Rethrow subscribe exceptions just like assertion failures by omitting
  // try/catch here.
  const feed = await ops.subscribe(session, undefined, url, 7000, false);

  // Test the subscription produced the desired result
  assert(feed);
  assert(cdb.is_feed(feed));
  assert(cdb.is_valid_feed_id(feed.id));

  // Length may be 1 or 2 (may have redirected and captured new url)
  assert(feed.urls.length);
  assert(feed.urls.includes(url.href));
  assert(feed.active);

  // Assert that the subscription sent out correct messages
  assert(messages.length === 1);
  assert(messages[0].type === 'feed-created');
  assert(messages[0].id === feed.id);

  // Test teardown
  session.close();
  await idb.remove(db_name);
}
