import assert from '/src/assert/assert.js';
import {activate_feed} from '/src/db/activate-feed.js';
import {create_feed} from '/src/db/create-feed.js';
import * as feed_utils from '/src/db/feed-utils.js';
import {get_feed} from '/src/db/get-feed.js';
import {open} from '/src/db/open.js';
import {remove} from '/src/db/remove.js';
import * as types from '/src/db/types.js';
import {register_test} from '/src/test/test-registry.js';

// Verify the activate-feed function works as expected
async function activate_feed_test() {
  // Test setup
  const db_name = 'activate-feed-test';

  // This test is flaky right now. I am not using try/finally to ensure the
  // database is removed at the end of the test when an exception occurs. It
  // leaves the database as existing, which then causes ripple effect errors
  // here when reusing the existing database. So just delete the database if it
  // exists first to avoid the headache.
  await remove(db_name);

  const session = await open(db_name);

  // Setup a fake channel for recording messages for later assertions. Do not
  // immediately attach it to the session because we want to exclude other calls
  // that broadcast.
  const messages = [];
  const channel = {};
  channel.postMessage = message => messages.push(message);

  // Create an inactive feed and store it
  const feed = feed_utils.create_feed_object();
  feed.active = false;
  feed_utils.append_feed_url(feed, new URL('a://b.c'));
  const id = await create_feed(session, feed);

  // Now attach the channel. We wait until now to skip over create-feed
  session.channel = channel;

  // Run the primary operation of this test. This should succeed without error.
  await activate_feed(session, id);

  // Detach the channel. Just rules out any chance of awkwardness with out of
  // order execution in this test.
  session.channel = undefined;

  // TODO: the following assertion fails. The problem is that right now
  // activate-feed makes use of update-feed internally, and forwards its channel
  // implicitly when it forwards its session. update-feed also sends out a
  // message about a feed being updated. The proper behavior, I think, is that
  // only 1 message should be produced, activate-feed. So activate-feed needs to
  // be changed somehow to produce only its own message.

  // Activating a feed should have produced a single message of a certain type
  assert(messages.length === 1, JSON.stringify(messages));
  assert(messages[0].type === 'activate-feed');

  const stored_feed = await get_feed(session, 'id', id, false);

  // Activation should not have somehow destroyed type info
  assert(types.is_feed(stored_feed));

  // Activation should result in the active state
  assert(stored_feed.active === true);
  assert(stored_feed.deactivateDate === undefined);
  assert(stored_feed.deactivationReasonText === undefined);

  // TODO: this is a second test. This should be in a separate test function
  // because it is a different test. Or not? It is nice to reuse the setup
  // and teardown of the first test.

  // Activating a feed that is already active should fail
  // TODO: if activate-feed is changed to throw a more specific error type, I
  // would prefer to test against that specific error type so there is no chance
  // a different type of error is occurring
  let activation_error;
  try {
    await activate_feed(session, id);
  } catch (error) {
    activation_error = error;
  }
  assert(activation_error);

  // Test teardown
  session.close();
  await remove(db_name);
}

register_test(activate_feed_test);
