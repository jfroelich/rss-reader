import assert from "/src/common/assert.js";
import {CheckedError} from "/src/common/errors.js";
import {setTimeoutPromise} from "/src/common/promise-utils.js";
import * as Status from "/src/common/status.js";

const DEBUG = false;

// Returns true if the conn is open. This should only be used with databases opened by this library.
export function isOpen(conn) {
  return conn instanceof IDBDatabase && typeof conn.onabort === 'function';
}

// Wraps a call to indexedDB.open that imposes a time limit and translates blocked events into
// errors.
//
// @param name {String}
// @param version {Number} optional
// @param upgradeListener {Function} optional, react to upgradeneeded events
// @param timeoutMs {Number} optional, positive integer, how long to wait in milliseconds before
// giving up on connecting
// @throws {Error} if connection error or timeout occurs
export async function open(name, version, upgradeListener, timeoutMs) {
  assert(typeof name === 'string');

  if(isNaN(timeoutMs)) {
    timeoutMs = 0;
  }
  assert(Number.isInteger(timeoutMs) && timeoutMs >= 0);

  let timedout = false;
  let timer;
  let timeoutPromise;

  const openPromise = new Promise(function openExecutor(resolve, reject) {
    if(DEBUG) {
      console.debug('Connecting to database', name, version);
    }

    let blocked = false;
    const request = indexedDB.open(name, version);
    request.onsuccess = function(event) {
      const conn = event.target.result;

      // There is no need to reject on block/timeout here, because the promise already
      // settled

      if(blocked) {
        console.log('Closing connection %s that eventually unblocked after settling', conn.name);
        conn.close();
      } else if(timedout) {
        console.log('Closing connection %s that eventually opened after settling', conn.name);
        conn.close();
      } else {
        if(DEBUG) {
          console.debug('Connected to database', name, version);
        }

        // Use the onabort listener property as a flag to indicate to isOpen that the connection is
        // open
        conn.onabort = function noop() {};

        // NOTE: this is only invoked if force closed by error
        conn.onclose = function() {
          // Indicate to isOpen that the connection is closed
          conn.onabort = undefined;
          console.log('connection was forced closed', conn.name);
        };

        resolve(conn);
      }
    };

    request.onblocked = function(event) {
      blocked = true;
      const errorMessage = 'Connection to database ' + name + ' blocked';
      const error = new Error(errorMessage);
      reject(error);
    };

    request.onerror = () => reject(request.error);

    // NOTE: an upgrade can still happen in the event of a rejection. I am not trying to prevent
    // that as an implicit side effect, although it is possible to abort the versionchange
    // transaction from within the upgrade listener. If I wanted to do that I would wrap the call
    // to the listener here with a function that first checks if blocked/timedout and if so aborts
    // the transaction and closes, otherwise forwards to the listener.
    request.onupgradeneeded = upgradeListener;
  });

  if(!timeoutMs) {
    let conn;
    try {
      conn = await openPromise;
    } catch(error) {
      return [Status.EDBOPEN];
    }

    return [Status.OK, conn];
  }

  [timer, timeoutPromise] = setTimeoutPromise(timeoutMs);

  let conn;

  try {
    conn = await Promise.race([openPromise, timeoutPromise]);
  } catch(error) {
    return [Status.EDBOPEN];
  }

  // conn is undefined when timeout promise wins

  if(conn) {
    // Pseudo-cancel the timeout promise
    clearTimeout(timer);

    return [Status.OK, conn];
  } else {
    // I want to cancel the open, but this operation isn't supported. Instead, it will eventually
    // resolve and see that timedout is true and immediately close.
    timedout = true;
    const errorMessage = 'Connecting to database ' + name + ' timed out';
    //throw new TimeoutError(errorMessage);

    return [Status.ETIMEOUT];
  }
}

//class TimeoutError extends CheckedError {
//  constructor(message) {
//    super(message || 'Operation timed out');
//  }
//}

// Requests to close 0 or more indexedDB connections
// @param {...IDBDatabase}
export function close(...conns) {
  for(const conn of conns) {
    if(conn && conn instanceof IDBDatabase) {
      if(DEBUG) {
        console.debug('Closing connection to database', conn.name);
      }

      // Signal to isOpen that the connection is closed/closing
      conn.onabort = null;
      conn.close();
    }
  }
}

export function remove(name) {
  return new Promise(function executor(resolve, reject) {
    if(DEBUG) {
      console.debug('Deleting database', name);
    }

    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
