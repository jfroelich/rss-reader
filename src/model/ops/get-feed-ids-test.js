import {assert} from '/src/assert.js';
import * as indexeddb_utils from '/src/indexeddb-utils/indexeddb-utils.js';
import {Model} from '/src/model/model.js';
import create_feed from '/src/model/ops/create-feed.js';
import get_feed_ids from '/src/model/ops/get-feed-ids.js';
import {Feed} from '/src/model/types/feed.js';

export async function get_feed_ids_test() {
  const db_name = 'get-feed-ids-test';
  await indexeddb_utils.remove(db_name);
  const model = new Model();
  model.name = db_name;
  await model.open();
  const n = 5;
  const create_promises = [];
  for (let i = 0; i < n; i++) {
    const feed = new Feed();
    const url = new URL('a://b.c/feed' + i + '.xml');
    feed.appendURL(url);
    const promise = create_feed(model, feed);
    create_promises.push(promise);
  }
  const created_feed_ids = await Promise.all(create_promises);
  const feed_ids = await get_feed_ids(model);
  assert(feed_ids.length === created_feed_ids.length);
  for (const id of created_feed_ids) {
    assert(feed_ids.includes(id));
  }
  model.close();
  await indexeddb_utils.remove(db_name);
}
