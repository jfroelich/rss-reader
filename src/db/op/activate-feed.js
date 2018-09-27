import assert from '/src/assert/assert.js';
import {is_valid_feed_id} from '/src/db/feed-utils.js';
import {update_feed} from '/src/db/idb-model.js';

// TODO: in hindsight, i think this should be decoupled from update_feed even
// though it requires more code and repetition. I feel like the nested
// transition function is wonky. i like the idea of having ops be separate. but
// i am on the fence right now, and focused more on moving back to separate ops.
// TODO: this should have its own test file. right now there is some helper
// test stuff in idb-model-test.js. That should be in a file named
// activate-feed-test.js
// TODO: consider having the open-db function return an object, let's call it
// 'session', that has properties conn and channel. then change this to accept
// a session instead of a conn and channel.
// TODO: use more specific error types, because js requires errors be part of
// control flow logic and the caller may want to differentiate between kinds of
// database errors. For example, an 'already-active' or 'invalid-state' error
// is quite different than the database being unreadable or the channel being
// in a closed state.
// TODO: make a markdown document for documentation

export async function activate_feed(conn, channel, feed_id) {
  assert(is_valid_feed_id(feed_id));
  await activate_feed_internal(conn, feed_id);

  // TODO: make channel non-optional again? require a stub?
  if (channel) {
    const message = {type: 'feed-activated', id: feed_id};
    channel.postMessage(message);
  }
}

function activate_feed_internal(conn, feed_id) {
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

  return update_feed(conn, {id: feed_id}, transition);
}
