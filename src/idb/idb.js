// Opens a connection to an indexedDB database. The important additions to the
// normal functionality of indexedDB.open are that you can optionally specify a
// timeout after which to consider the connection a failure, and that a blocked
// connection is treated as an error (and the connection is automatically closed
// should it ever open later).
export async function idb_open(name, version, upgrade_listener, timeout) {
  if (typeof name !== 'string') {
    throw new TypeError('Invalid name ' + name);
  }

  if (!isNaN(timeout) && (!Number.isInteger(timeout) || timeout < 0)) {
    throw new TypeError('Invalid timeout ' + timeout);
  }

  const context = {
    name: name,
    version: version,
    upgrade_listener: upgrade_listener,
    timeout: timeout,
    timed_out: false,
    timer: null
  };

  const conn = await (timeout ? create_open_promise(context) : Promise.race([
    create_open_promise(context), create_timeout_promise(context)
  ]));

  if (conn) {
    clearTimeout(context.timer);
  } else {
    context.timed_out = true;
    throw new Error('Connection timed out');
  }

  return conn;
}

function create_timeout_promise(context) {
  return new Promise(resolve => {
    context.timer = setTimeout(resolve, context.timeout);
  });
}

function create_open_promise(context) {
  return new Promise((resolve, reject) => {
    console.debug('Connecting to database', context.name);
    let blocked = false;
    const request = indexedDB.open(context.name, context.version);
    request.onsuccess = function(event) {
      const conn = event.target.result;
      if (blocked) {
        console.debug('Closing connection %s that unblocked', conn.name);
        conn.close();
      } else if (context.timed_out) {
        console.debug(
            'Closing connection %s that opened after timeout', conn.name);
        conn.close();
      } else {
        console.debug('Connected to database', conn.name);
        resolve(conn);
      }
    };

    request.onblocked = function(event) {
      blocked = true;
      reject(new Error('Connection blocked'));
    };

    request.onerror = () => reject(request.error);

    // NOTE: an upgrade can still happen in the event of a rejection. I am not
    // trying to prevent that as an implicit side effect, although it is
    // possible to abort the versionchange transaction from within the upgrade
    // listener. If I wanted to do that I would wrap the call to the listener
    // here with a function that first checks if blocked/timed_out and if so
    // aborts the transaction and closes, otherwise forwards to the listener.
    request.onupgradeneeded = context.upgrade_listener;
  });
}
