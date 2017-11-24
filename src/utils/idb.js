import assert from "/src/assert.js";
import isPosInt from "/src/utils/is-pos-int.js";
import setTimeoutPromise from "/src/utils/set-timeout-promise.js";

const DEBUG = false;

// Returns true if the conn is open. This should only be used with indexedDB databases opened by
// this library.
export function isOpen(conn) {
  return conn instanceof IDBDatabase && conn.onabort;
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
      console.debug('connecting to database', name, version);
    }

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
        if(DEBUG) {
          console.debug('connected to database', name, version);
        }

        // Use the onabort listener property as a flag to indicate to isOpenDB that the connection
        // is currently open
        conn.onabort = function noop() {};

        // NOTE: this is only invoked if force closed by error
        conn.onclose = function() {
          conn.onabort = undefined;
          console.log('connection was forced closed', conn.name);
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

    // NOTE: an upgrade can still happen in the event of a rejection. I am not trying to prevent
    // that as an implicit side effect, although it is possible to abort the versionchange
    // transaction from within the upgrade listener. If I wanted to do that I would wrap the call
    // to the listener here with a function that first checks if blocked/timedout and if so aborts
    // the transaction and closes, otherwise forwards to the listener.
    request.onupgradeneeded = upgradeListener;
  });

  if(!timeoutMs) {
    // Ordinarily it would make sense to just return the promise. However, the await pulls out a
    // promise rejection and translates it into an uncaught exception.
    return await openPromise;
  }

  [timer, timeoutPromise] = setTimeoutPromise(timeoutMs);

  const conn = await Promise.race([openPromise, timeoutPromise]);
  if(conn) {
    clearTimeout(timer);
  } else {
    timedout = true;
    // TODO: create and use a TimedOutError or something along those lines. TimeoutError should be
    // defined in utils/errors.js or in promises.js.
    const errorMessage = 'connecting to database ' + name + ' timed out';
    throw new Error(errorMessage);
  }

  return conn;
}

// Requests to close 0 or more indexedDB connections
// @param {...IDBDatabase}
export function close(...conns) {
  // NOTE: undefined conns does not raise an error, the loop simply never iterates.
  for(const conn of conns) {
    // This is routinely called in a finally block, so try never to throw
    if(conn && conn instanceof IDBDatabase) {
      if(DEBUG) {
        console.debug('closing connection to database', conn.name);
      }

      // Ensure that isOpenDB returns false
      conn.onabort = null;
      conn.close();
    }
  }
}

// A promise wrapper around indexedDB.deleteDatabase
export function remove(name) {
  return new Promise(function executor(resolve, reject) {
    if(DEBUG) {
      console.debug('deleting database', name);
    }

    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
