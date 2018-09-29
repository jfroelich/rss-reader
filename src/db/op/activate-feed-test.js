import assert from '/src/assert/assert.js';
import * as feed_utils from '/src/db/feed-utils.js';
import * as idbmodel from '/src/db/idb-model.js';
import {activate_feed} from '/src/db/op/activate-feed.js';
import {create_feed} from '/src/db/op/create-feed.js';
import {get_feed} from '/src/db/op/get-feed.js';
import * as types from '/src/db/types.js';
import * as indexeddb from '/src/indexeddb/indexeddb.js';
import {register_test} from '/src/test/test-registry.js';

// Verify the activate-feed function works as expected
async function activate_feed_test() {
  // Create a database and store an inactive feed within it.
  const feed = feed_utils.create_feed();
  feed.active = false;
  feed_utils.append_feed_url(feed, new URL('a://b.c'));

  const conn = await idbmodel.open('activate-feed-test');
  const id = await create_feed(conn, undefined, feed);

  // Run the primary operation of this test. This should succeed without error.
  await activate_feed(conn, undefined, id);

  const stored_feed = await get_feed(conn, 'id', id, false);

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
    await activate_feed(conn, undefined, id);
  } catch (error) {
    activation_error = error;
  }
  assert(activation_error);

  // TODO: test that a channel receives a message as expected

  conn.close();

  // TODO: i would prefer to decouple the indexeddb module from this test. one
  // way i think is to have a wrapper function in model-access.js or whereever
  // the open-db function is located named remove, that just forwards its call
  // to indexeddb.remove. by loading the open-db function i would implicitly
  // also load the remove function of that module, and would no longer need to
  // load the indexeddb module here, resulting in less coupling. in some ways
  // this current design is a violation because this 'knows' that the db is of
  // type indexeddb, which is forbidden knowledge because it means the open-db
  // function is not hiding information well.
  await indexeddb.remove(conn.name);
}

register_test(activate_feed_test);
