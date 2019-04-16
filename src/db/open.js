import * as indexedDBUtils from '/src/lib/indexeddb-utils.js';
import * as migrations from '/src/db/migrations.js';
import { Deadline } from '/src/lib/deadline.js';
import Connection from '/src/db/connection.js';
import assert from '/src/lib/assert.js';

export const defaultName = 'reader';
export const defaultVersion = 35;
export const defaultChannelName = 'reader';
export const defaultTimeout = new Deadline(5000);

// Asynchronously connect to the app's indexedDB database
// @param timeout {Deadline} optional
// @return {Promise} a promise that resolves to a connection {Connection}
export default async function open(timeout = defaultTimeout) {
  assert(timeout instanceof Deadline);

  const conn = new Connection();
  const channel = new BroadcastChannel(defaultChannelName);

  function upgradeNeededHandler(event) {
    defaultUpgradeNeededHandler(channel, event);
  }

  conn.channel = channel;
  conn.conn = await indexedDBUtils.open(defaultName, defaultVersion, upgradeNeededHandler, timeout);
  return conn;
}

export function defaultUpgradeNeededHandler(channel, event) {
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
  migrations.migrate30(event, channel);
  migrations.migrate31(event, channel);
  migrations.migrate32(event, channel);
  migrations.migrate33(event, channel);
  migrations.migrate34(event, channel);
  migrations.migrate35(event, channel);
}
