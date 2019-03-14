import {assert} from '/src/assert.js';
import * as indexeddb_utils from '/src/indexeddb-utils/indexeddb-utils.js';
import {Model} from '/src/model/model.js';
import create_feeds from '/src/model/ops/create-feeds.js';
import get_feed from '/src/model/ops/get-feed.js';
import {Feed, is_feed} from '/src/model/types/feed.js';

export async function create_feeds_test() {
  const db_name = 'create-feeds-test';

  const model = new Model();
  model.name = db_name;
  await model.open();

  const num_feeds = 3, feeds = [];
  for (let i = 0; i < num_feeds; i++) {
    const feed = new Feed();
    feed.appendURL(new URL('a://b.c' + i));
    feeds.push(feed);
  }
  const ids = await create_feeds(model, feeds);
  assert(ids.length === num_feeds);
  const stored_feeds = await model.getFeeds('all', false);
  assert(stored_feeds.length === num_feeds);
  const get_proms = ids.map(id => get_feed(model, 'id', id, false));
  const feeds_by_id = await Promise.all(get_proms);
  for (const feed of feeds_by_id) {
    assert(is_feed(feed));
    assert(Feed.isValidId(feed.id));
  }
  model.close();
  await indexeddb_utils.remove(db_name);
}
