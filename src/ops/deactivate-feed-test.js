import {assert} from '/src/assert.js';
import * as indexeddb_utils from '/src/indexeddb-utils/indexeddb-utils.js';
import {Feed, is_feed} from '/src/model/feed.js';
import {Model} from '/src/model/model.js';
import {deactivate_feed} from '/src/ops/deactivate-feed.js';

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
  await deactivate_feed(session, feed_id, 'testing');
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
