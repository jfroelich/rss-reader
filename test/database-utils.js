import assert from '/lib/assert.js';
import { INDEFINITE } from '/lib/deadline.js';
import * as indexedDBUtils from '/lib/indexeddb-utils.js';
import { open } from '/lib/indexeddb-utils.js';
import * as db from '/src/db/db.js';
import RecordingChannel from '/test/recording-channel.js';

// A global counter that resides in memory.
let name_counter = 0;
const database_names = [];

// Create a unique database name given a prefix
export function create_unique_database_name(prefix) {
  assert(typeof prefix === 'string');
  const name = `${prefix}-${name_counter}`;
  name_counter++;
  database_names.push(name);
  console.debug('Created database name:', name);
  return name;
}

// Find any database names that start with the prefix and remove them. Returns
// a promise that resolves when all remove operations complete.
export function remove_databases_for_prefix(prefix) {
  const previous_names = find_database_full_names(prefix);
  const promises = previous_names.map((name) => {
    console.debug('Removing database with name', name);
    return indexedDBUtils.remove(name);
  });
  return Promise.all(promises);
}

// Given a database name prefix, finds the full database names in the list of
// database names previously created that start with the prefix.
export function find_database_full_names(prefix) {
  return database_names.filter(name => name.startsWith(prefix));
}

// Open a database connection for testing purposes. If an upgrade handler is
// not specified then this uses the same upgrade handler as db/open
export async function create_test_database(
  name, version = db.default_version,
  upgrade_handler = db.default_upgrade_handler,
) {
  // A custom name is required in the test context. We also impose a non-zero
  // length guard just because that is reasonable. This would be caught later
  // by the open call but I like being explicit.
  // We could also impose that it is not equal to the app's live channel, but
  // I decided not to in case a test wants to exercise the live channel.
  assert(name && typeof name === 'string');

  const conn = new db.Connection();

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
  const handler_wrapper = (event) => {
    // channel comes first as an artifact of prior implementation that used
    // bind to create a partial. we no longer use bind, but keeping it this way
    // in case we revert to bind. just note the awkward parameter order.
    upgrade_handler(conn.channel, event);
  };

  conn.conn = await open(name, version, handler_wrapper, timeout);
  return conn;
}
