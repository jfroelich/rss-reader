'use strict';

// import base/number.js
// import base/promise.js

// Returns true if the conn is open. This should only be used with connections
// opened and closed by this module.
// @param conn {IDBDatabase}
function indexeddb_is_open(conn) {
  // The instanceof check is basically an implied assertion that the
  // connection is defined, and is of the proper type.
  // The onabort condition is used to detect if open because it is defined
  // when opened by indexeddb_open and undefined when closed by
  // indexeddb_close
  return conn instanceof IDBDatabase && conn.onabort;
}

// Wraps a call to indexedDB.open that imposes a time limit and translates
// blocked events into errors.
//
// @param name {String}
// @param version {Number} optional
// @param upgrade_listener {Function} optional, react to upgradeneeded events
// @param timeout_ms {Number} optional, positive integer, how long to wait
// in milliseconds before giving up on connecting
// @throws {Error} if connection error or timeout occurs
async function indexeddb_open(name, version, upgrade_listener, timeout_ms) {
  console.log('connecting to database', name, version);
  console.assert(typeof name === 'string');
  if(isNaN(timeout_ms)) {
    timeout_ms = 0;
  }

  console.assert(number_is_positive_integer(timeout_ms));

  let timedout = false;
  let timer;

  const open_promise = new Promise(function o_exec(resolve, reject) {
    let blocked = false;
    const request = indexedDB.open(name, version);
    request.onsuccess = function(event) {
      const conn = event.target.result;
      if(blocked) {
        console.log('closing connection %s that unblocked', conn.name);
        conn.close();
      } else if(timedout) {
        console.log('closing connection %s opened after timeout', conn.name);
        conn.close();
      } else {
        console.log('connected to database', name, version);

        // Use the onabort listener property as a flag to indicate to
        // indexeddb_is_open that the connection is currently open
        conn.onabort = function noop() {};

        // NOTE: MDN says this works, but it does not
        conn.onclose = function() {
          console.log('closing connection', conn.name);
        };

        resolve(conn);
      }
    };

    request.onblocked = function(event) {
      blocked = true;
      const error_message = name + ' blocked';
      const error = new Error(error_message);
      reject(error);
    };

    request.onerror = () => reject(request.error);

    // NOTE: an upgrade can still happen in the event of a rejection. I am
    // not trying to prevent that as an implicit side effect, although it is
    // possible to abort the versionchange transaction from within the
    // upgrade listener. If I wanted to do that I would wrap the call to the
    // listener here with a function that first checks if blocked/timedout
    // and if so aborts the transaction and closes, otherwise forwards to the
    // listener.
    request.onupgradeneeded = upgrade_listener;
  });

  if(!timeout_ms) {
    // Allow exception to bubble
    return await open_promise;
  }

  let time_promise;
  [timer, time_promise] = promise_timeout(timeout_ms);

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

function indexeddb_close(conn) {
  if(conn) {
    console.debug('closing connection to database', conn.name);

    // Ensure that indexeddb_is_open returns false
    conn.onabort = null;

    conn.close();
  }
}

function indexeddb_delete_database(name) {
  return new Promise(function executor(resolve, reject) {
    console.debug('deleting database', name);
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
