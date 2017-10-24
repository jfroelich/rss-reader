'use strict';

// Returns true if the conn is open
// @param conn {IDBDatabase}
function indexeddb_is_open(conn) {
  console.assert(conn instanceof IDBDatabase);
  // TODO: only return true if connection is actually open. Not quite sure
  // how to detect this at the moment.
  return true;
}

// Wraps indexedDB.open with a timeout to avoid block events
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
async function indexeddb_open(name, version, upgrade_listener, timeout_ms) {
  console.log('indexeddb_open', name, version, timeout_ms);
  console.assert(typeof name === 'string');

  if(typeof timeout_ms === 'undefined') {
    timeout_ms = 0;
  }

  console.assert(Number.isInteger(timeout_ms));
  console.assert(timeout_ms >= 0);

  let timedout = false;
  let timer;

  const open_promise = new Promise(function o_exec(resolve, reject) {
    const request = indexedDB.open(name, version);
    request.onsuccess = function(event) {
      const conn = event.target.result;
      if(timedout) {
        console.log('closing connection %s that opened after timeout',
          conn.name);
        conn.close();
        // Leave unsettled
      } else {
        console.log('indexeddb_open opened connection to', name, version);
        resolve(conn);
      }
    };
    request.onerror = () => reject(request.error);
    // Leave unsettled
    // request.onblocked = () => {};
    request.onupgradeneeded = upgrade_listener;
  });

  if(!timeout_ms) {
    // Allow exception to bubble
    return await open_promise;
  }

  // TODO: delegate to promise_timeout instead of re-implementing it here? But
  // how do I easily obtain timer pre resolution?
  const time_promise = new Promise(function t_exec(resolve, reject) {
    timer = setTimeout(resolve, timeout_ms);
  });

  // Allow exception to bubble
  const conn = await Promise.race([open_promise, time_promise]);

  if(conn) {
    clearTimeout(timer);
  } else {
    timedout = true;
    const error_message = 'connecting to database ' + name + ' timed out';
    throw new Error(error_message);
  }

  return conn;
}
