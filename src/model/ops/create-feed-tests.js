import {assert} from '/src/assert.js';
import * as indexeddb_utils from '/src/indexeddb-utils/indexeddb-utils.js';
import {Model} from '/src/model/model.js';
import create_feed from '/src/model/ops/create-feed.js';
import get_feed from '/src/model/ops/get-feed.js';
import {Feed, is_feed} from '/src/model/types/feed.js';

export async function create_feed_test() {
  const db_name = 'create-feed-test';
  const model = new Model();
  model.name = db_name;
  await model.open();

  const feed = new Feed();
  const feed_url = new URL('http://www.example.com/example.rss');
  feed.appendURL(feed_url);
  const stored_feed_id = await create_feed(model, feed);
  assert(Feed.isValidId(stored_feed_id));
  let stored_feed = await get_feed(model, 'url', feed_url, true);
  assert(is_feed(stored_feed));
  stored_feed = await get_feed(model, 'id', stored_feed_id, false);
  assert(is_feed(stored_feed));
  model.close();
  await indexeddb_utils.remove(db_name);
}

export async function create_feed_url_constraint_test() {
  const db_name = 'create-feed-url-constraint-test';
  const model = new Model();
  model.name = db_name;
  await model.open();

  const feed1 = new Feed();
  feed1.appendURL(new URL('http://www.example.com/example.rss'));
  const feed2 = new Feed();
  feed2.appendURL(new URL('http://www.example.com/example.rss'));

  await create_feed(model, feed1);
  let create_error;
  try {
    await create_feed(model, feed2);
  } catch (error) {
    create_error = error;
  }

  // Verify that the second attempt to store fails as expected
  assert(create_error instanceof DOMException);
  model.close();
  await indexeddb_utils.remove(db_name);
}
