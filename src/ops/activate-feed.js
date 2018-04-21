import {write_feed_property} from '/src/ops/write-feed-property.js';

// TODO: update deactivate-feed sibling op
// TODO: test new implementation using write_feed_property
// TODO: let write_feed_property do the channel send, first need to change all
// callers to listen for new message type (deprecate feed-activated type)
// TODO: deprecate, caller should call write_feed_property directly, do this
// after channel delegation change
// TODO: cleanup docs now that they are out of date, but write the
// write_feed_property docs first, since a ton is duplicated

export async function activate_feed(feed_id) {
  // Create a dummy channel because write_feed_property requires one but we
  // want to suppress it
  const channel_stub = {name: 'stub', postMessage: noop, close: noop};

  const op = {};
  op.conn = this.conn;
  op.console = this.console;
  // Suppress the message since we will send our own (for now)
  op.channel = channel_stub;
  op.write = write_feed_property;

  await op.write(feed_id, 'active', true);
  this.channel.postMessage({type: 'feed-activated', id: feed_id});
}

function noop() {}
