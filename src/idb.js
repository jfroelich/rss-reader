'use strict';

// A low level module that provides utility functions for indexedDB


// TODO: move the timed open connection stuff to here, so that it can be
// shared by reader-db.js and favicon.js instead of repeating that stuff
// there.
// TODO: and even then, the whole idea of a timed promise could be abstracted
// into some type of promise utils library that this then depends on, along
// with the logic in fetch.js


// Returns true if conn is an IDBDatabase instance.
function idb_is_conn(conn) {

  // TODO: I optimized for the failure case. That's backwards. I want to
  // optimize for the successful case. The vast majority of the time conn
  // is valid. Like 99% of the time. Maybe one solution is to tie the check
  // to a global debug flag and leave it off? Or maybe just go straight to
  // the heavyweight toString call because the other two conditions are
  // implicit?

  // First check conn truthiness. It is the fastest check so it exploits
  // short-circuiting.
  // Also, it avoids the issue with typeof null === 'object'.
  // Next, check that conn type is 'object'. It is faster than the toString
  // call so the condition fails faster. Finally do the toString call.
  // Use the toString.call technique to avoid instance.toString mangling.

  // Strict equality has higher precedence than logical and.

  return conn &&
    typeof conn === 'object' &&
    Object.prototype.toString.call(conn) === '[object IDBDatabase]';
}


// Returns true if the conn is open
// @param conn {IDBDatabase}
function idb_conn_is_open(conn) {
  ASSERT(idb_is_conn(conn));

  // TODO: only return true if connection is open, which i think is approximated
  // by something like !conn.closePending? I've done some research and so far
  // no success. There is no public property of IDBDatabase that allows me to
  // check synchronously. Until then this lies by omission.
  // One idea would be to build a wrapper object, track state, pass arond
  // the wrapper only, and track force closes, and at least make an assertion
  // about whether wrapper.close ever called?

  return true;
}
