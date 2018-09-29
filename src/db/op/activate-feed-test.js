import assert from '/src/assert/assert.js';
import * as db from '/src/db/db.js';
import * as feed_utils from '/src/db/feed-utils.js';
import {activate_feed} from '/src/db/op/activate-feed.js';
import {create_feed} from '/src/db/op/create-feed.js';
import {get_feed} from '/src/db/op/get-feed.js';
import * as types from '/src/db/types.js';
import {register_test} from '/src/test/test-registry.js';

// TODO: test that a channel receives a message as expected


// Verify the activate-feed function works as expected
async function activate_feed_test() {
  // Create a database and store an inactive feed within it.
  const feed = feed_utils.create_feed();
  feed.active = false;
  feed_utils.append_feed_url(feed, new URL('a://b.c'));

  const session = await db.open('activate-feed-test');

  const id = await create_feed(session.conn, session.channel, feed);

  // Run the primary operation of this test. This should succeed without error.
  await activate_feed(session.conn, session.channel, id);

  const stored_feed = await get_feed(session.conn, 'id', id, false);

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
    await activate_feed(session.conn, session.channel, id);
  } catch (error) {
    activation_error = error;
  }
  assert(activation_error);


  const db_name = session.conn.name;
  session.close();
  await db.remove(db_name);
}

register_test(activate_feed_test);
