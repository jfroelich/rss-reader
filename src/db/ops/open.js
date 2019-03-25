import Connection from '/src/db/connection.js';
import * as migrations from '/src/db/migrations.js';
import * as types from '/src/db/types.js';
import assert from '/src/lib/assert.js';
import {Deadline} from '/src/lib/deadline.js';
import * as indexeddb_utils from '/src/lib/indexeddb-utils.js';

export const default_name = 'reader';
export const default_version = 29;
export const default_channel_name = 'reader';
export const default_timeout = new Deadline(5000);

// Asynchronously connect to the app's indexedDB database
// @param timeout {Deadline} optional
// @return {Promise} a promise that resolves to a connection {Connection}
export default async function open(timeout = default_timeout) {
  assert(timeout instanceof Deadline);

  const conn = new Connection();
  const channel = new BroadcastChannel(default_channel_name);

  const upgrade_handler = event => {
    default_upgrade_handler(channel, event);
  };

  conn.channel = channel;
  conn.conn = await indexeddb_utils.open(
      default_name, default_version, upgrade_handler, timeout);
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
