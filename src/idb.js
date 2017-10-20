'use strict';

// import base/assert.js


// A low level module that provides utility functions for indexedDB
// TODO: refactor favicon.js to use this
// TODO: maybe move the timeout promise to promise.js helper module


const IDB_FAST_CONN_TEST = true;

// Returns true if conn is an IDBDatabase instance.
// @param conn {any} an IDBDatabase connection
function idb_is_conn(conn) {
  if(IDB_FAST_CONN_TEST) {
    // TODO: optimize for conn usually valid case
    // would !conn || typeof conn !== 'object' work to short circuit favorably
    // in the success case? what about duck typing?
    return conn;
  } else {
    // Short circuits favorably in the failure case
    // Strict equality has higher precedence than logical and.
    return conn &&
      typeof conn === 'object' &&
      Object.prototype.toString.call(conn) === '[object IDBDatabase]';
  }
}

// Returns true if the conn is open
// @param conn {IDBDatabase}
function idb_conn_is_open(conn) {
  ASSERT(idb_is_conn(conn));
  // TODO: only return true if connection is actually open. Not quite sure
  // how to detect this at the moment.
  return true;
}

// Opens a connection to indexedDB. Augments indexedDB.open with a timeout to
// avoid the issue of blocked events hanging indefinitely.
//
// @param name {String}
// @param version {Number} optional
// @param upgrade_listener {Function} optional, react to upgradeneeded events
// @param timeout_ms {Number} optional, positive integer, how long to wait
// in milliseconds before giving up on connecting
// @throws {Error} if connection error or timeout occurs
async function idb_open(name, version, upgrade_listener, timeout_ms) {

  ASSERT(typeof name === 'string');

  if(typeof timeout_ms === 'undefined') {
    timeout_ms = 0;
  }

  ASSERT(Number.isInteger(timeout_ms));
  ASSERT(timeout_ms >= 0);

  // Set to true if timeout occurred. This is shared state.
  let timedout = false;

  let timer;

  const open_promise = new Promise(function o_exec(resolve, reject) {
    const request = indexedDB.open(name, version);
    request.onsuccess = function(event) {
      const conn = event.target.result;

      if(timedout) {
        DEBUG('closing connection that opened after timeout');
        conn.close();
        // TODO: why even reject? just leave unsettled?
        reject(new Error('connected after timeout'));
      } else {
        resolve(conn);
      }
    };
    request.onerror = function(event) {
      reject(request.error);
    };
    request.onblocked = function(event) {
      DEBUG('promise unsettled, blocked');
    };
    request.onupgradeneeded = upgrade_listener;
  });

  if(!timeout_ms) {
    // If this fails an exception is thrown.
    return open_promise;
  }

  const error_message = 'connecting to database ' + name + ' timed out.';

  const time_promise = new Promise(function t_exec(resolve, reject) {
    timer = setTimeout(function on_timeout() {

      // This message should NOT appear in the console if conn successful
      DEBUG('timeout reached');

      reject(new Error(error_message));
    }, timeout_ms);
  });

  const race_promise = Promise.race([open_promise, time_promise]);

  let conn;
  try {
    conn = await race_promise;

    // If we connected then 'cancel' the timeout promise. Because promises are
    // not cancelable, just cancel the timer.
    clearTimeout(timer);
  } catch(error) {

    // An error occurred because of:
    // 1) Connection failed (rare expected case)
    // 2) Timed out (common expected case)
    // 3) Other unexpected (unexpected syntax error)

    // TODO: a simpler way of differentiating between 1 and 2 is to have
    // time promise resolve instead of reject. If it resolves with undefined,
    // then conn will be undefined. That way both promises resolve to the same
    // type, and an exception occurs only in the case of 1 and 3.

    ASSERT(!timedout);
    timedout = true;

    throw error;
  }

  return conn;
}
