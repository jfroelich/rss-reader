import * as channeled_model from '/src/model/channeled-model.js';
import {assert} from '/src/lib/assert.js';
import {INDEFINITE} from '/src/lib/deadline.js';
import * as idb from '/src/lib/idb.js';

export async function cdb_delete_feed_test() {
  const db_name = 'channeled_model-delete-feed-test';
  await idb.remove(db_name);

  const session = new channeled_model.ChanneledModel();
  session.db.name = db_name;
  await session.open();

  const feed1 = new channeled_model.Feed();
  const url1 = new URL('http://www.example.com/foo.xml');
  feed1.appendURL(url1);
  const feed_id1 = await session.createFeed(feed1);
  const messages = [];
  const channel = {};
  channel.name = 'delete-feed-test-channel';
  channel.postMessage = message => messages.push(message);
  channel.close = function() {};
  session.channel = channel;
  const delete_reason = 'test-reason';
  await session.deleteFeed(feed_id1, delete_reason);
  assert(messages.length === 1);
  const first_message = messages[0];
  assert(typeof first_message === 'object');
  assert(first_message.type === 'feed-deleted');
  assert(first_message.id === feed_id1);
  assert(first_message.reason === delete_reason);
  session.close();
  await idb.remove(db_name);
}
