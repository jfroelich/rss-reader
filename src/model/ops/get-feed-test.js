import {assert} from '/src/assert.js';
import * as indexeddb_utils from '/src/indexeddb-utils/indexeddb-utils.js';
import {Model} from '/src/model/model.js';
import create_feed from '/src/model/ops/create-feed.js';
import get_feed from '/src/model/ops/get-feed.js';
import {Feed} from '/src/model/types/feed.js';

export async function get_feed_test() {
  const db_name = 'get-feed-test';
  await indexeddb_utils.remove(db_name);
  const model = new Model();
  model.name = db_name;
  await model.open();
  const feed = new Feed();
  const url = new URL('a://b.c');
  feed.appendURL(url);
  const feed_id = await create_feed(model, feed);
  assert(Feed.isValidId(feed_id));
  const stored_feed = await get_feed(model, 'id', feed_id, false);
  assert(stored_feed);
  const stored_feed2 = await get_feed(model, 'url', url, false);
  assert(stored_feed2);
  model.close();
  await indexeddb_utils.remove(db_name);
}
