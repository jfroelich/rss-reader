'use strict';

// import base/assert.js
// import base/number.js
// import base/promise.js

// Returns true if the conn is open. This should only be used with connections
// opened and closed by this module.
// @param conn {IDBDatabase}
function indexedDBIsOpen(conn) {
  // The instanceof check is basically an implied assertion that the
  // connection is defined, and is of the proper type.
  // The onabort condition is used to detect if open because it is defined
  // when opened by indexedDBOpen and undefined when closed by
  // indexedDBClose
  return conn instanceof IDBDatabase && conn.onabort;
}

// Wraps a call to indexedDB.open that imposes a time limit and translates
// blocked events into errors.
//
// @param name {String}
// @param version {Number} optional
// @param upgradeListener {Function} optional, react to upgradeneeded events
// @param timeoutMs {Number} optional, positive integer, how long to wait
// in milliseconds before giving up on connecting
// @throws {Error} if connection error or timeout occurs
async function indexedDBOpen(name, version, upgradeListener, timeoutMs) {
  assert(typeof name === 'string');
  if(isNaN(timeoutMs)) {
    timeoutMs = 0;
  }

  assert(numberIsPositiveInteger(timeoutMs));

  let timedout = false;
  let timer;

  const openPromise = new Promise(function openExecutor(resolve, reject) {
    console.log('connecting to database', name, version);
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
        // indexedDBIsOpen that the connection is currently open
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
      const errorMessage = name + ' blocked';
      const error = new Error(errorMessage);
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
    request.onupgradeneeded = upgradeListener;
  });

  if(!timeoutMs) {
    // Allow exception to bubble
    return await openPromise;
  }

  let timeoutPromise;
  [timer, timeoutPromise] = promiseTimeout(timeoutMs);

  // Allow exception to bubble
  const conn = await Promise.race([openPromise, timeoutPromise]);

  if(conn) {
    clearTimeout(timer);
  } else {
    timedout = true;
    const errorMessage = 'connecting to database ' + name + ' timed out';
    throw new Error(errorMessage);
  }

  return conn;
}

// Requests to close 0 or more connections
// Does not fail if no connections given or if any one connection is falsy
// @param ...cons {spread} one or more parameters each of type IDBDatabase
function indexedDBClose(...conns) {
  for(const conn of conns) {
    if(conn) {
      console.debug('closing connection to database', conn.name);
      // Ensure that indexedDBIsOpen returns false
      conn.onabort = null;
      conn.close();
    }
  }
}

function indexedDBDeleteDatabase(name) {
  return new Promise(function executor(resolve, reject) {
    console.debug('deleting database', name);
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
