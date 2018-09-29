import assert from '/src/assert/assert.js';
import * as feed_utils from '/src/db/feed-utils.js';
import {update_feed} from '/src/db/op/update-feed.js';

export async function deactivate_feed(conn, channel, feed_id, reason) {
  assert(feed_utils.is_valid_feed_id(feed_id));
  await deactivate_feed_internal(conn, channel, feed_id, reason);

  if (channel) {
    channel.postMessage({type: 'feed-deactivated', id: feed_id});
  }
}

function deactivate_feed_internal(conn, channel, feed_id, reason) {
  function transition(feed) {
    if (!feed.active) {
      throw new Error('Cannot deactivate inactive feed with id ' + feed.id);
    }

    const now = new Date();
    feed.deactivationReasonText = reason;
    feed.deactivateDate = now;
    feed.dateUpdated = now;
    feed.active = false;
    return feed;
  }

  return update_feed(conn, channel, {id: feed_id}, transition);
}
