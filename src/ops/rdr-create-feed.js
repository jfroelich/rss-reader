import {feed_is_valid, feed_prepare} from '/src/objects/feed.js';
import {rdr_update_feed} from '/src/ops/rdr-update-feed.js';

const channel_stub = {
  name: 'stub',
  postMessage: noop,
  close: noop
};

export async function rdr_create_feed(
    conn, channel = channel_stub, feed, sanitize = true) {
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

  const update_context = {};
  update_context.conn = conn;
  // Silence the update message, we substitute our own
  update_context.channel = channel_stub;
  // TODO: get from parameter instead
  update_context.console = void console;

  const update_options = {};
  // We already sanitized above
  // TODO: delegate sanitization to update?
  update_options.sanitize = false;
  // Do not validate, we validate ourselves it at all
  // TODO: should we actually be validating?
  update_options.validate = false;
  // Since it is a new object, it has never been updated. This is the default,
  // but I prefer to be explicit for now
  update_options.set_date_updated = false;

  const feed_id =
      await rdr_update_feed.call(update_context, clean_feed, update_options);

  channel.postMessage({type: 'feed-added', id: feed_id});

  clean_feed.id = feed_id;
  return clean_feed;
}

function noop() {}
