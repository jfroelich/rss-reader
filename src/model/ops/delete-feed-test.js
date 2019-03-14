import {assert} from '/src/assert.js';
import * as indexeddb_utils from '/src/indexeddb-utils/indexeddb-utils.js';
import {Model} from '/src/model/model.js';
import create_feed from '/src/model/ops/create-feed.js';
import delete_feed from '/src/model/ops/delete-feed.js';
import get_feed from '/src/model/ops/get-feed.js';
import {Feed} from '/src/model/types/feed.js';

export async function delete_feed_test() {
  const db_name = 'delete-feed-test';
  await indexeddb_utils.remove(db_name);

  const model = new Model();
  model.name = db_name;
  await model.open();

  const feed1 = new Feed();
  const url1 = new URL('http://www.example.com/foo.xml');
  feed1.appendURL(url1);
  const feed_id1 = await create_feed(model, feed1);

  const messages = [];
  const channel = {};
  channel.name = 'delete-feed-test-channel';
  channel.postMessage = message => messages.push(message);
  channel.close = function() {};
  model.channel = channel;

  const delete_reason = 'test-reason';
  await delete_feed(model, feed_id1, delete_reason);

  assert(messages.length === 1);
  const first_message = messages[0];
  assert(typeof first_message === 'object');
  assert(first_message.type === 'feed-deleted');
  assert(first_message.id === feed_id1);
  assert(first_message.reason === delete_reason);

  model.close();
  await indexeddb_utils.remove(db_name);
}

// TODO: resolve conflict with delete_feed_test, note this is not registered in
// the test registry
export async function delete_feed_test2() {
  const db_name = 'delete-feed-test2';
  await indexeddb_utils.remove(db_name);
  const model = new Model();
  model.name = db_name;
  await model.open();

  const feed1 = new Feed();
  const url1 = new URL('http://www.example.com/foo.xml');
  feed1.appendURL(url1);
  const feed_id1 = await create_feed(model, feed1);
  const feed2 = new Feed();
  const url2 = new URL('http://www.example.com/bar.xml');
  feed2.appendURL(url2);
  const feed_id2 = await create_feed(model, feed2);
  await delete_feed(model, feed_id1);
  const stored_feed1 = await get_feed(model, 'id', feed_id1, false);
  assert(!stored_feed1);
  const stored_feed2 = await get_feed(model, 'id', feed_id2, false);
  assert(stored_feed2);
  const non_existent_id = 123456789;
  await delete_feed(model, non_existent_id);
  await delete_feed(model, feed_id2);
  model.close();
  await indexeddb_utils.remove(db_name);
}
