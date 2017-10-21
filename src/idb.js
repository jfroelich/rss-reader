'use strict';

// import base/assert.js

// Returns true if the conn is open
// @param conn {IDBDatabase}
function idb_conn_is_open(conn) {
  ASSERT(conn instanceof IDBDatabase);
  // TODO: only return true if connection is actually open. Not quite sure
  // how to detect this at the moment.
  return true;
}

// Opens a connection to indexedDB. Augments indexedDB.open with a timeout to
// avoid the issue of blocked events hanging indefinitely.
//
// TODO: what if there is no need to timeout? Just reject on block, and
// check if blocked fired on success. I suppose the only benefit is the timeout
// is basically a temporary toleration of blocked state? I could just reject
// and it would be faster. error.type will be blocked instead of another type
// of error so can still differentiate error reason. and can set a blocked
// outerscope variable that success checks at the point it resolves to
// determine if it should close. I suppose another minor benefit is just
// setting an upper bound on the operation time. But I quibble with whether
// that is even worth it.
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

  let timedout = false;
  let timer;

  const open_promise = new Promise(function o_exec(resolve, reject) {
    const request = indexedDB.open(name, version);
    request.onsuccess = function(event) {
      const conn = event.target.result;

      if(timedout) {
        DEBUG('closing connection that opened after timeout');
        conn.close();
        conn = null;
        // Leave the promise unsettled forever
      } else {
        resolve(conn);
      }
    };
    request.onerror = function(event) {
      reject(request.error);
    };
    request.onblocked = function(event) {
      DEBUG('blocked');
      // Leave the promise unsettled indefinitely
    };
    request.onupgradeneeded = upgrade_listener;
  });

  if(!timeout_ms) {
    // await so that a possible rejection becomes an uncaught exception
    return await open_promise;
  }

  // TODO: delegate to promise_timeout instead of re-implementing it here?

  const time_promise = new Promise(function t_exec(resolve, reject) {
    timer = setTimeout(function on_timeout() {
      // Resolve with undefined so that both open promise and time promise
      // resolve to the 'same' type.
      resolve();
    }, timeout_ms);
  });

  // If open promise rejected prior to the timeout resolution during the race,
  // then allow an uncaught exception.
  const conn = await Promise.race([open_promise, time_promise]);

  if(conn) {
    // If we connected then 'cancel' the timeout promise. Because promises are
    // not cancelable, just cancel the timer.
    clearTimeout(timer);
  } else {
    // conn is falsy, which indicates a timeout. Toggle timedout so that if
    // and when the open promise resolves, it closes its connection.
    timedout = true;

    // Simulate a timeout rejection by manually throwing
    const error_message = 'connecting to database ' + name + ' timed out';
    throw new Error(error_message);
  }

  return conn;
}
