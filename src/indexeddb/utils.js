import assert from "/src/assert/assert.js";
import {TimeoutError} from "/src/operations/timed-operation.js";
import isPosInt from "/src/utils/is-pos-int.js";
import setTimeoutPromise from "/src/promise/set-timeout.js";

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
  assert(isPosInt(timeoutMs));

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
    // Ordinarily it would make sense to just return the promise. However, the await pulls out a
    // promise rejection and translates it into an uncaught exception. I'd rather throw an
    // uncaught exception that rely on an implict rejection to be interpreted as an exception by
    // the caller.
    return await openPromise;
  }

  [timer, timeoutPromise] = setTimeoutPromise(timeoutMs);

  const conn = await Promise.race([openPromise, timeoutPromise]);
  if(conn) {
    // Pseudo-cancel the timeout promise
    clearTimeout(timer);
  } else {
    // I want to cancel the open, but this operation isn't supported. Instead, it will eventually
    // resolve and see that timedout is true and immediately close.
    timedout = true;
    const errorMessage = 'Connecting to database ' + name + ' timed out';
    throw new TimeoutError(errorMessage);
  }

  return conn;
}

// Requests to close 0 or more indexedDB connections
// @param {...IDBDatabase}
export function close(...conns) {
  // NOTE: for rest params, conns is still defined when there are no args, it is an empty array
  for(const conn of conns) {
    // This is routinely called in a finally block, so try never to throw
    if(conn && conn instanceof IDBDatabase) {
      if(DEBUG) {
        console.debug('Closing connection to database', conn.name);
      }

      // Signal to isOpen that the connection is closed (even if it is just 'closing' and not yet
      // closed)
      conn.onabort = null;
      conn.close();
    }
  }
}

// A promise wrapper around deleteDatabase
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
