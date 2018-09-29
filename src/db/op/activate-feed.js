import assert from '/src/assert/assert.js';
import {is_valid_feed_id} from '/src/db/feed-utils.js';
import {update_feed} from '/src/db/op/update-feed.js';

export async function activate_feed(session, feed_id) {
  assert(is_valid_feed_id(feed_id));
  await activate_feed_internal(session, feed_id);

  if (session.channel) {
    const message = {type: 'feed-activated', id: feed_id};
    session.channel.postMessage(message);
  }
}

function activate_feed_internal(session, feed_id) {
  function transition(feed) {
    if (feed.active) {
      throw new Error('Feed already active for id ' + feed_id);
    }

    feed.active = true;
    delete feed.deactivateDate;
    delete feed.deactivationReasonText;
    feed.dateUpdated = new Date();
    return feed;
  }

  // TODO: use a real feed, this does not work because update_feed asserts
  // feed.type
  return update_feed(session, {id: feed_id}, transition);
}
