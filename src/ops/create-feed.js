import {is_feed} from '/src/objects/feed.js';
import {update_feed} from '/src/ops/update-feed.js';

export async function create_feed(feed, sanitize = true) {
  if (!is_feed(feed)) {
    throw new TypeError('Invalid feed parameter ' + feed);
  }

  const clone = Object.assign(feed_create(), feed);

  clone.active = true;
  clone.dateCreated = new Date();
  delete clone.dateUpdated;

  const update_op = {};
  update_op.conn = this.conn;

  // Suppress the message coming from update so that we can substitute our own
  // by using a mock channel that sends messages nowhere.
  update_op.channel = {name: 'stub', postMessage: noop, close: noop};

  update_op.console = this.console;
  update_op.update_feed = update_feed;

  const update_options = {};
  update_options.sanitize = sanitize;
  update_options.validate = true;
  update_options.set_date_updated = false;

  const stored_feed = update_op.update_feed(clone, update_options);

  this.channel.postMessage({type: 'feed-added', id: stored_feed.id});
  return stored_feed;
}

function noop() {}
