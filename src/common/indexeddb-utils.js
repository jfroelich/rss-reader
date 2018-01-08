import formatString from "/src/common/format-string.js";
import {setTimeoutPromise} from "/src/common/promise-utils.js";
import * as Status from "/src/common/status.js";

// The primary benefits of this module include:
// * The ability to quickly check if the IDBDatabase is open based on whether onabort is set,
// because there is no native ergonomic alternative.
// * The ability to fail when opening a connection if it takes too long
// * Promises
// * Use of status codes instead of exceptions
// * Light guarding against indexedDB API changes
// * Logging for debugging


export async function open(name, version, upgradeListener, timeout) {
  if(typeof name !== 'string') {
    return [Status.EINVAL, null, stringFormat('Expected string name, got', typeof name)];
  }

  if(isNaN(timeout)) {
    timeout = 0;
  }

  if(!Number.isInteger(timeout) || timeout < 0) {
    return [Status.EINVAL, null,
      stringFormat('Expected timeout positive integer, got', typeof name)];
  }

  let timedout = false;
  let timer;
  let timeoutPromise;
  let conn;

  const openPromise = new Promise(function openExecutor(resolve, reject) {
    console.debug('Connecting to database', name, version);
    let blocked = false;
    const request = indexedDB.open(name, version);
    request.onsuccess = function(event) {
      const conn = event.target.result;
      // There is no need to reject on block/timeout because the promise already settled
      if(blocked) {
        console.log('Closing connection %s that eventually unblocked', conn.name);
        conn.close();
      } else if(timedout) {
        console.log('Closing connection %s that eventually opened after timeout', conn.name);
        conn.close();
      } else {
        console.debug('Connected to database', name, version);
        conn.onabort = noop;
        conn.onclose = function() {
          conn.onabort = undefined;
          console.log('Connection was forced closed', conn.name);
        };
        resolve(conn);
      }
    };

    request.onblocked = function(event) {
      blocked = true;
      const errorMessage = formatString('Connection to database %s blocked', name);
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

  if(timeout < 1) {
    let conn;
    try {
      conn = await openPromise;
    } catch(error) {
      return [Status.EDBOPEN];
    }
    return [Status.OK, conn];
  }

  [timer, timeoutPromise] = setTimeoutPromise(timeout);
  try {
    conn = await Promise.race([openPromise, timeoutPromise]);
  } catch(error) {
    return [Status.EDBOPEN];
  }

  if(conn) {
    clearTimeout(timer);
    return [Status.OK, conn];
  } else {
    timedout = true;
    const message = formatString('Connecting to database %s timed out', name);
    return [Status.ETIMEOUT, null, message];
  }
}

export function isOpen(conn) {
  return conn instanceof IDBDatabase && typeof conn.onabort === 'function';
}

// Requests to close 0 or more indexedDB connections
// @param {...IDBDatabase}
export function close(...conns) {
  for(const conn of conns) {
    if(conn && conn instanceof IDBDatabase) {
      console.debug('Closing connection to database', conn.name);
      conn.onabort = null;
      conn.close();
    }
  }
}

export function remove(name) {
  return new Promise(function executor(resolve, reject) {
    console.debug('Deleting database', name);
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function noop() {}
