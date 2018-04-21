import {write_feed_property} from '/src/ops/write-feed-property.js';

// TODO: see activate-feed todos

export async function deactivate_feed(feed_id, reason) {
  const channel_stub = {name: 'stub', postMessage: noop, close: noop};
  const op = {};
  op.conn = this.conn;
  op.console = this.console;
  op.channel = channel_stub;
  op.write = write_feed_property;
  const prop_name = 'active';
  const prop_value = false;
  const extra_props = {reason: reason};
  await op.write(feed_id, prop_name, prop_value, extra_props);
  this.channel.postMessage({type: 'feed-deactivated', id: feed_id});
}

function noop() {}
