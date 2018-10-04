import assert from '/src/assert/assert.js';
import {activate_feed} from './activate-feed.js';
import {create_feed} from './create-feed.js';
import * as errors from './errors.js';
import * as feed_utils from './feed-utils.js';
import {get_feed} from './get-feed.js';
import {open} from './open.js';
import {remove} from './remove.js';
import * as types from './types.js';

// Verify the activate-feed function works as expected
export async function activate_feed_test() {
  // Test setup
  const db_name = 'activate-feed-test';

  // I am not using try/finally to ensure the database is removed at the end of
  // the test when an exception occurs. It leaves the database as existing,
  // which then causes ripple effect errors here when reusing the existing
  // database. So just delete the database if it exists first to avoid the
  // headache.
  await remove(db_name);

  const session = await open(db_name);

  // Setup a fake channel for recording messages for later assertions. Do not
  // immediately attach it to the session because we want to ignore certain
  // calls that broadcast messages.
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

  // Run the primary focus of this test. This should succeed without error. This
  // implies quite a lot, including that the feed object was found in the
  // database, that the object was of type feed, and that the feed was not
  // already in the active state.
  await activate_feed(session, id);

  // Detach the channel. Just rules out any chance of awkwardness with out of
  // order execution in this test.
  session.channel = undefined;

  // Activating a feed should have produced a single message of a certain type
  assert(messages.length === 1);
  assert(messages[0].type === 'feed-updated');

  // Read the feed back out of the database to investigate
  const stored_feed = await get_feed(session, 'id', id, false);

  // Activation should not have somehow destroyed type info. For performance
  // reasons this check is NOT implicit in the get_feed call, so it is not
  // redundant or unreasonable to check here.
  assert(types.is_feed(stored_feed));

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
    await activate_feed(session, id);
  } catch (error) {
    activation_error = error;
  }
  assert(activation_error);

  // Activating a feed that does not exist should fail.
  const fictitious_feed_id = 123456789;
  activation_error = undefined;
  try {
    await activate_feed(session, fictitious_feed_id);
  } catch (error) {
    activation_error = error;
  }
  assert(activation_error);

  // Test teardown
  session.close();
  await remove(db_name);
}
