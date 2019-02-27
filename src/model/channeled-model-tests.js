import {assert} from '/src/lib/assert.js';
import {INDEFINITE} from '/src/lib/deadline.js';
import * as indexeddb_utils from '/src/lib/indexeddb-utils.js';
import {ChanneledModel} from '/src/model/channeled-model.js';
import {Feed} from '/src/model/feed.js';

export async function delete_feed_test() {
  const db_name = 'delete-feed-test';
  await indexeddb_utils.remove(db_name);

  const model = new ChanneledModel();
  model.db.name = db_name;
  await model.open();

  const feed1 = new Feed();
  const url1 = new URL('http://www.example.com/foo.xml');
  feed1.appendURL(url1);
  const feed_id1 = await model.createFeed(feed1);

  const messages = [];
  const channel = {};
  channel.name = 'delete-feed-test-channel';
  channel.postMessage = message => messages.push(message);
  channel.close = function() {};
  model.channel = channel;

  const delete_reason = 'test-reason';
  await model.deleteFeed(feed_id1, delete_reason);

  assert(messages.length === 1);
  const first_message = messages[0];
  assert(typeof first_message === 'object');
  assert(first_message.type === 'feed-deleted');
  assert(first_message.id === feed_id1);
  assert(first_message.reason === delete_reason);

  model.close();
  await indexeddb_utils.remove(db_name);
}
