import assert from '/src/base/assert.js';

import {create_feed} from './create-feed.js';
import * as feed_utils from './feed-utils.js';
import {get_feed} from './get-feed.js';
import {open} from './open.js';
import {remove} from './remove.js';
import {update_feed} from './update-feed.js';

export async function update_feed_test() {
  // Test setup
  const db_name = 'update-feed-test';
  await remove(db_name);
  const session = await open(db_name);

  const messages = [];
  const channel = {};
  channel.postMessage = message => messages.push(message);
  channel.close = noop;

  let feed = feed_utils.create_feed_object();
  feed.title = 'first';
  const url = new URL('a://b.c');
  feed_utils.append_feed_url(feed, url);
  let new_id = await create_feed(session, feed);
  feed.id = new_id;

  session.channel = channel;

  // Update the feed's title property
  feed.title = 'second';
  await update_feed(session, feed, true);

  session.channel = undefined;
  feed = undefined;  // paranoia
  feed = await get_feed(session, 'id', new_id, false);

  // The title should be updated to the new title
  assert(feed.title = 'second');

  // Check messages
  assert(messages.length === 1);
  const message = messages[0];
  assert(message.type === 'feed-updated');
  assert(message.id === feed.id);

  // Test teardown
  session.close();
  await remove(db_name);
}

function noop() {}
