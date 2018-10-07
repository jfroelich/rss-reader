import * as icondb from './icondb.js';

// Async. Opens and returns a connection to the service's internal database.
//
// The conn has a sync close method. The return type is IDBDatabase, but this
// is not guaranteed to stay that type in the future, the only type guarantee
// is the presence of a synchronous close method.
//
// This will create the database if it is does not exist as an implied side
// effect. Similarly this will update the database as an implied side effect
// if the version changed.
//
// Throws errors if the connection takes too long to open, if if a database
// error of some kind occurs
export function open() {
  // TODO: icondb will be database neutral, so which database to use should
  // come from here. However, this will ultimately also be neutral, so this
  // should take optional params that default to default settings

  return icondb.open();
}

// Removes all entries in the service's database (e.g. clearing the cache)
export function clear(conn) {
  // TODO: implement
  return icondb.clear(conn);
}

// Removes older entries from the service's database to reduce its size
export function compact(conn) {
  // TODO: implement
  return icondb.compact(conn);
}

// A parameters object for use with lookup calls
export function LookupRequest() {
  this.conn;
  this.url;
  this.document;
  this.should_fetch = true;
}

// Look up the favicon for a given request
export function lookup(request) {
  // TODO: implement
}
