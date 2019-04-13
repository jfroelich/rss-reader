import assert from '/lib/assert.js';
import { Deadline, INDEFINITE } from '/lib/deadline.js';

// Opens a connection to an indexedDB database. The primary benefits over using
// indexedDB.open directly are that this works as a promise, enables a timeout,
// and translates blocked events into errors (and still closes if ever open).
//
// An upgrade can still happen in the event of a rejection. For now, I am not
// trying to prevent that as an implicit side effect, although it is possible to
// abort the versionchange transaction from within the upgrade listener. If I
// wanted to do that I would wrap the call to the listener here with a function
// that first checks if blocked/timedOut and if so aborts the transaction and
// closes, otherwise forwards to the listener.
export async function open(name, version, onupgrade, timeout = INDEFINITE) {
  assert(typeof name === 'string');
  assert(timeout instanceof Deadline);

  let timedOut = false;
  let timer = null;

  const openPromise = new Promise((resolve, reject) => {
    let blocked = false;
    const request = indexedDB.open(name, version);
    request.onupgradeneeded = onupgrade;

    request.onsuccess = function (event) {
      const conn = event.target.result;

      // If we blocked, we rejected the promise earlier so just exit. The extra
      // rejection here is irrelevant.
      if (blocked) {
        console.debug('Closing connection "%s" that unblocked', conn.name);
        conn.close();
        return;
      }

      // If we timed out, settle the promise. The settle mode is irrelevant.
      if (timedOut) {
        console.debug('Closing connection "%s" after timeout %s', conn.name, timeout);
        conn.close();
        resolve();
        return;
      }

      resolve(conn);
    };

    request.onblocked = function (event) {
      const conn = event.target.result;
      blocked = true;
      const error = new BlockError(`Blocked connecting to ${conn}` ? conn.name : 'undefined');
      reject(error);
    };

    request.onerror = () => reject(request.error);
  });

  let connectionPromise;
  if (timeout.isDefinite()) {
    const timeoutPromise = new Promise((resolve) => {
      timer = setTimeout(resolve, timeout.toInt());
    });
    connectionPromise = Promise.race([openPromise, timeoutPromise]);
  } else {
    connectionPromise = openPromise;
  }

  const conn = await connectionPromise;
  if (!conn) {
    timedOut = true;
    throw new TimeoutError(`Failed to connect to database "${name}" within ${timeout} ms`);
  }

  clearTimeout(timer);
  return conn;
}

export function remove(name) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = resolve;
    request.onerror = () => reject(request.error);
  });
}

export class TimeoutError extends Error {
  constructor(message = 'Operation timed out') {
    super(message);
  }
}

export class BlockError extends Error {
  constructor(message = 'Connection blocked') {
    super(message);
  }
}
