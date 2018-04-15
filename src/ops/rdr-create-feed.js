import {feed_is_valid, feed_prepare} from '/src/objects/feed.js';
import {rdr_update_feed} from '/src/ops/rdr-update-feed.js';

const null_channel = {
  name: 'null-channel',
  postMessage: noop,
  close: noop
};

export async function rdr_create_feed(
    conn, channel = null_channel, feed, sanitize = true) {
  if (!feed_is_valid(feed)) {
    throw new TypeError('feed is invalid: ' + feed);
  }

  let clean_feed;
  if (sanitize) {
    clean_feed = feed_prepare(feed);
  } else {
    clean_feed = Object.assing(feed_create(), feed);
  }

  clean_feed.active = true;
  clean_feed.dateCreated = new Date();
  delete clean_feed.dateUpdated;

  let void_channel;
  const validate = false;
  const set_date_updated = false;

  // In this situation, we do not want to sanitize. If any sanitization is being
  // performed, it is done explicitly above, by rdr_create_feed, so we should
  // avoid doing it again
  const update_sanitize = false;

  const feed_id = await rdr_update_feed(
      conn, void_channel, clean_feed, validate, update_sanitize,
      set_date_updated);

  channel.postMessage({type: 'feed-added', id: feed_id});

  clean_feed.id = feed_id;
  return clean_feed;
}

function noop() {}
