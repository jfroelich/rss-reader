import * as locatable from '/src/db/locatable.js';
import Feed from '/src/db/object/feed.js';
import activate_feed from '/src/db/ops/activate-feed.js';
import create_feed from '/src/db/ops/create-feed.js';
import get_feed from '/src/db/ops/get-feed.js';
import db_open from '/src/db/ops/open.js';
import {is_feed} from '/src/db/types.js';
import assert from '/src/lib/assert.js';
import * as indexeddb_utils from '/src/lib/indexeddb-utils.js';

export async function activate_feed_test() {
  const db_name = 'db-activate-feed-test';
  await indexeddb_utils.remove(db_name);

  const conn = await db_open(db_name);

  // Create an inactive feed and store it
  const feed = new Feed();
  feed.active = false;
  locatable.append_url(feed, new URL('a://b.c'));
  const id = await create_feed(conn, undefined, feed);

  const messages = [];
  const channel = {};
  channel.name = 'activate-feed-test';
  channel.postMessage = message => messages.push(message);
  channel.close = function() {};

  // Run the primary focus of this test. This should succeed without error. This
  // implies quite a lot, including that the feed object was found in the
  // database, that the object was of type feed, and that the feed was not
  // already in the active state.
  await activate_feed(conn, channel, id);

  // Activating a feed should have produced a single message of a certain type
  assert(messages.length === 1);
  assert(messages[0].type === 'feed-updated');

  // Read the feed back out of the database to investigate
  const stored_feed = await get_feed(conn, 'id', id, false);

  // Activation should not have somehow destroyed type info. For performance
  // reasons this check is NOT implicit in the get_feed call, so it is not
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
    await activate_feed(conn, channel, id);
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
    await activate_feed(conn, channel, fake_feed_id);
  } catch (error) {
    activation_error = error;
  }
  assert(activation_error);

  conn.close();
  channel.close();
  await indexeddb_utils.remove(db_name);
}
