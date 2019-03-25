import Connection from '/src/db/connection.js';
import * as migrations from '/src/db/migrations.js';
import * as types from '/src/db/types.js';
import assert from '/src/lib/assert.js';
import {Deadline, INDEFINITE} from '/src/lib/deadline.js';
import * as indexeddb_utils from '/src/lib/indexeddb-utils.js';

// Asynchronously connect to the indexedDB database
// @param name {String} the name of the database
// @param version {Number} the version of the database
// @param upgrade_handler {Function}
// @param timeout {Deadline} optional
// @param channel_name {String} optional, the channel to send messages, defaults
// to 'reader'. Normal usage should leave as is, tests should use some name
// other than the default.
// @param channel_class {Function} optional, the class of the channel, defaults
// to {BroadcastChannel}
// @return {Promise} a promise that resolves to a connection {Connection}
export default async function open(
    name = 'reader', version = 29, timeout = INDEFINITE,
    channel_name = 'reader', channel_class = BroadcastChannel) {
  const conn = new Connection();
  conn.channel = new channel_class(channel_name);

  const upgrade_handler = event => {
    default_upgrade_handler(conn.channel, event);
  };

  conn.conn =
      await indexeddb_utils.open(name, version, upgrade_handler, timeout);
  return conn;
}

export function default_upgrade_handler(channel, event) {
  migrations.migrate20(event, channel);
  migrations.migrate21(event, channel);
  migrations.migrate22(event, channel);
  migrations.migrate23(event, channel);
  migrations.migrate24(event, channel);
  migrations.migrate25(event, channel);
  migrations.migrate26(event, channel);
  migrations.migrate27(event, channel);
  migrations.migrate28(event, channel);
  migrations.migrate29(event, channel);
}
