import assert from '/src/assert/assert.js';
import * as feed_utils from '/src/db/feed-utils.js';
import * as idbmodel from '/src/db/idb-model.js';
import * as object from '/src/db/object-utils.js';
import * as types from '/src/db/types.js';

// Connects to the model. Instantiates and returns a wrapper class that serves
// as a data access layer for reading from and writing to app persistent storage
//
// @param is_channeled {Boolean} optional, if true then this establishes a
// connection to the app's broadcast channel that will potentially be used by
// methods that modify database state. Generally, use true when reading and
// writing, and use false when only reading.
// @param name {String} optional, database name
// @param version {Number} optional, database version
// @param timeout {Number} optional, ms before considering opening attempt a
// failure
// @throws {DOMException} some kind of database error, failed to connect,
// failed to apply upgrades to new version, etc.
// @throws {Error} invalid arguments
// @throws {Error} failed to create channel
// @return {Promise} resolves to a ModelAccess object
export async function openModelAccess(is_channeled, name, version, timeout) {
  const ma = new ModelAccess();
  if (is_channeled) {
    ma.channel = new BroadcastChannel('reader');
  }

  name = name === undefined ? 'reader' : name;
  version = version === undefined ? 24 : version;
  timeout = timeout === undefined ? 500 : timeout;
  ma.conn = await idbmodel.open(name, version, undefined, timeout);
  return ma;
}

export function ModelAccess() {
  this.conn = undefined;
  this.channel = undefined;
}

ModelAccess.prototype.close = function() {
  if (this.channel) {
    this.channel.close();
  }
  this.conn.close();
};
