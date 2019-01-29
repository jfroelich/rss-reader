import assert from '/src/assert.js';
import * as cdb from '/src/cdb.js';
import {INDEFINITE} from '/src/deadline.js';
import * as idb from '/src/idb.js';

export async function cdb_delete_feed_test() {
  const db_name = 'cdb-delete-feed-test';
  await idb.remove(db_name);
  const session = await cdb.open(db_name, undefined, INDEFINITE);
  const feed1 = cdb.construct_feed();
  const url1 = new URL('http://www.example.com/foo.xml');
  cdb.append_feed_url(feed1, url1);
  const feed_id1 = await cdb.create_feed(session, feed1);
  const messages = [];
  const channel = {};
  channel.name = 'delete-feed-test-channel';
  channel.postMessage = message => messages.push(message);
  channel.close = function() {};
  session.channel = channel;
  const delete_reason = 'test-reason';
  await cdb.delete_feed(session, feed_id1, delete_reason);
  assert(messages.length === 1);
  const first_message = messages[0];
  assert(typeof first_message === 'object');
  assert(first_message.type === 'feed-deleted');
  assert(first_message.id === feed_id1);
  assert(first_message.reason === delete_reason);
  session.close();
  await idb.remove(db_name);
}
