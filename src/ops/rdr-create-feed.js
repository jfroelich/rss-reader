import {is_feed} from '/src/objects/feed.js';
import {rdr_update_feed} from '/src/ops/rdr-update-feed.js';

const channel_stub = {
  name: 'stub',
  postMessage: noop,
  close: noop
};

export async function rdr_create_feed(
    conn, channel = channel_stub, feed, sanitize = true) {
  if (!is_feed(feed)) {
    throw new TypeError('feed parameter is not a feed ' + feed);
  }

  const clone = Object.assing(feed_create(), feed);

  clone.active = true;
  clone.dateCreated = new Date();
  delete clone.dateUpdated;

  const update_op = {};
  update_op.conn = conn;
  // Silence the update message, we substitute our own
  update_op.channel = channel_stub;
  // TODO: get from parameter instead
  update_op.console = void console;
  update_op.run = rdr_update_feed;

  const update_options = {};
  update_options.sanitize = sanitize;
  update_options.validate = true;
  update_options.set_date_updated = false;

  // const stored_feed =
  //    await rdr_update_feed.call(update_op, clone, update_options);
  const stored_feed = update_op.run(clone, update_options);

  channel.postMessage({type: 'feed-added', id: stored_feed.id});
  return stored_feed;
}

function noop() {}
