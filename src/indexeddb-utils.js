// Opens a connection to an indexedDB database. The primary benefits over using
// indexedDB.open directly are that this works as a promise, enables a timeout,
// and translates blocked events into errors (and still closes if ever open).
//
// An upgrade can still happen in the event of a rejection. For now, I am not
// trying to prevent that as an implicit side effect, although it is possible to
// abort the versionchange transaction from within the upgrade listener. If I
// wanted to do that I would wrap the call to the listener here with a function
// that first checks if blocked/timed_out and if so aborts the transaction and
// closes, otherwise forwards to the listener.
export async function open(name, version, upgrade_listener, timeout) {
  if (typeof name !== 'string') {
    throw new TypeError('Invalid database name ' + name);
  }

  if (!isNaN(timeout) && (!Number.isInteger(timeout) || timeout < 0)) {
    throw new TypeError('Invalid connection timeout ' + timeout);
  }

  let timed_out = false;
  let timer = null;

  const open_promise = new Promise((resolve, reject) => {
    let blocked = false;
    const request = indexedDB.open(name, version);
    request.onsuccess = function(event) {
      const conn = event.target.result;
      if (blocked) {
        console.debug('Closing connection %s that unblocked', conn.name);
        conn.close();
      } else if (timed_out) {
        console.debug('Closing connection %s opened after timeout', conn.name);
        conn.close();
      } else {
        resolve(conn);
      }
    };

    request.onblocked = function(event) {
      blocked = true;
      const error = new BlockError();
      reject(error);
    };

    request.onerror = () => reject(request.error);
    request.onupgradeneeded = upgrade_listener;
  });

  let conn_promise;
  if (timeout) {
    const timeout_promise = new Promise(resolve => {
      timer = setTimeout(resolve, timeout);
    });
    conn_promise = Promise.race([open_promise, timeout_promise]);
  } else {
    conn_promise = open_promise;
  }

  const conn = await conn_promise;
  if (!conn) {
    timed_out = true;
    const message = 'Failed to connect within ' + timeout + ' ms';
    throw new TimeoutError(message);
  }

  clearTimeout(timer);
  return conn;
}

export function remove(name) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = resolve;
    request.onerror = _ => reject(request.error);
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
