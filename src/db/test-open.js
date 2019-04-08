import assert from '/src/assert.js';
import Connection from '/src/db/connection.js';
import {default_upgrade_handler, default_version} from '/src/db/open.js';
import {INDEFINITE} from '/src/deadline/deadline.js';
import {open} from '/src/indexeddb-utils/indexeddb-utils.js';
import RecordingChannel from '/src/test/recording-channel.js';

// Open a database connection for testing purposes. If an upgrade handler is
// not specified then this uses the same upgrade handler as db/open
export default async function test_open(
    name, version = default_version,
    upgrade_handler = default_upgrade_handler) {
  // A custom name is required in the test context. We also impose a non-zero
  // length guard just because that is reasonable. This would be caught later
  // by the open call but I like being explicit.
  // We could also impose that it is not equal to the app's live channel, but
  // I decided not to in case a test wants to exercise the live channel.
  assert(name && typeof name === 'string');

  const conn = new Connection();

  // Presumably, all tests use some channel other than the app's default channel
  // to avoid tests having any unexpected side effect on the live app. Note that
  // for now all tests use the same channel name, so keep this in mind if
  // running tests concurrently.
  // TODO: channel-name should be a parameter and then set here so tests
  // can isolate the channel in order to make stronger assertions.
  conn.channel = new RecordingChannel();

  // Presumably, the test context does not care about the time it takes to open
  // a connection. This is also the default for open, but I like being explicit.
  const timeout = INDEFINITE;

  // Wrap the handler instead of using bind so as to maintain the current
  // context of the handler function in the case it is bound to something other
  // than the default context.
  const handler_wrapper = event => {
    // channel comes first as an artifact of prior implementation that used
    // bind to create a partial. we no longer use bind, but keeping it this way
    // in case we revert to bind. just note the awkward parameter order.
    upgrade_handler(conn.channel, event);
  };

  conn.conn = await open(name, version, handler_wrapper, timeout);
  return conn;
}
