// Open a connection to an indexedDB database
// @param name {String}
// @param version {Number}
// @param upgrade_listener {Function}
// @param timeout {Number}
export async function idb_open(name, version, upgrade_listener, timeout) {
  if (typeof name !== 'string') {
    throw new TypeError('Invalid database name ' + name);
  }

  if (!isNaN(timeout) && (!Number.isInteger(timeout) || timeout < 0)) {
    throw new TypeError('Invalid connection timeout ' + timeout);
  }

  const context = {
    name: name,
    version: version,
    upgrade_listener: upgrade_listener,
    timeout: timeout,
    timed_out: false,
    timer: null
  };

  // I do not understand why, but the parens are needed here or it is a syntax
  // error.
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
    request.onupgradeneeded = context.upgrade_listener;
  });
}
