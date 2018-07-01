import assert from '/src/lib/assert.js';
import * as indexeddb from '/src/lib/indexeddb.js';
import {openModelAccess} from '/src/model/model-access.js';
import * as Model from '/src/model/model.js';
import {register_test} from '/test/test-registry.js';

async function activate_feed_test() {
  const msgs = [];
  const ma = await openModelAccess(false, 'activate-feed-test');
  ma.channel = {name: 'stub', postMessage: msg => msgs.push(msg), close: noop};

  const feed = Model.create_feed();
  feed.active = false;
  Model.append_feed_url(feed, new URL('a://b.c'));

  const id = await ma.createFeed(feed);
  await ma.activateFeed(id);
  const stored_feed = await ma.getFeed('id', id, false);

  assert(Model.is_feed(stored_feed));
  assert(stored_feed.active === true);
  assert(stored_feed.deactivateDate === undefined);
  assert(stored_feed.deactivationReasonText === undefined);
  assert(msgs.length === 2);  // create + activate
  assert(msgs[1].type === 'feed-activated');
  assert(msgs[1].id === stored_feed.id);

  // Activating a feed that is already active should fail
  let activation_error;
  try {
    await ma.activateFeed(id);
  } catch (error) {
    activation_error = error;
  }
  assert(activation_error);

  ma.close();
  await indexeddb.remove(ma.conn.name);
}

function noop() {}

register_test(activate_feed_test);
