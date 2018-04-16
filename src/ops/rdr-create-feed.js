import {console_stub} from '/src/lib/console-stub/console-stub.js';
import {is_feed} from '/src/objects/feed.js';
import {rdr_update_feed} from '/src/ops/rdr-update-feed.js';

const channel_stub = {
  name: 'stub',
  postMessage: noop,
  close: noop
};

export async function rdr_create_feed(
    conn, channel = channel_stub, console = console_stub, feed,
    sanitize = true) {
  if (!is_feed(feed)) {
    throw new TypeError('feed parameter is not a feed ' + feed);
  }

  const clone = Object.assing(feed_create(), feed);

  clone.active = true;
  clone.dateCreated = new Date();
  delete clone.dateUpdated;

  const update_op = {};
  update_op.conn = conn;
  update_op.channel = channel_stub;  // suppress
  update_op.console = console;
  update_op.update_feed = rdr_update_feed;

  const update_options = {};
  update_options.sanitize = sanitize;
  update_options.validate = true;
  update_options.set_date_updated = false;

  const stored_feed = update_op.update_feed(clone, update_options);

  channel.postMessage({type: 'feed-added', id: stored_feed.id});
  return stored_feed;
}

function noop() {}
