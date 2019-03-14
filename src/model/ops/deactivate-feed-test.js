import {assert} from '/src/assert.js';
import * as indexeddb_utils from '/src/indexeddb-utils/indexeddb-utils.js';
import {Model} from '/src/model/model.js';
import create_feed from '/src/model/ops/create-feed.js';
import deactivate_feed from '/src/model/ops/deactivate-feed.js';
import get_feed from '/src/model/ops/get-feed.js';
import {Feed, is_feed} from '/src/model/types/feed.js';

export async function deactivate_feed_test() {
  const db_name = 'model-deactivate-feed-test';
  await indexeddb_utils.remove(db_name);

  const model = new Model();
  model.name = db_name;
  await model.open();

  const feed = new Feed();
  const url = new URL('a://b.c');
  feed.appendURL(url);
  feed.active = true;
  const feed_id = await create_feed(model, feed);
  model.channel.close();

  const messages = [];
  const channel = {};
  channel.postMessage = message => messages.push(message);
  channel.close = function() {};
  model.channel = channel;

  await deactivate_feed(model, feed_id, 'testing');

  const stored_feed = await get_feed(model, 'id', feed_id, false);
  assert(stored_feed);
  assert(is_feed(stored_feed));
  assert(stored_feed.active === false);
  assert(stored_feed.deactivateDate);
  const now = new Date();
  assert(stored_feed.deactivateDate <= now);
  model.close();
  await indexeddb_utils.remove(db_name);
}
