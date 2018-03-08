
function noop() {}

const null_console = {
  warn: noop,
  debug: noop,
  log: noop
};

function idb_context_t() {
  this.name = null;
  this.version = null;
  this.upgrade_listener = null;
  this.timeout = NaN;
  this.timed_out = false;
  this.timer = null;
  this.console = null_console;
}

export async function idb_open(
    name, version, upgrade_listener, timeout, console = null_console) {
  if (typeof name !== 'string') {
    throw new TypeError('Invalid database name ' + name);
  }

  if (!isNaN(timeout) && (!Number.isInteger(timeout) || timeout < 0)) {
    throw new TypeError('Invalid connection timeout ' + timeout);
  }

  const context = new idb_context_t();
  context.name = name;
  context.version = version;
  context.upgrade_listener = upgrade_listener;
  context.timeout = timeout;

  const open_promise = create_open_promise(context);

  let conn_promise;
  if (timeout) {
    const timeout_promise = create_timeout_promise(context);
    conn_promise = Promise.race([open_promise, timeout_promise]);
  } else {
    conn_promise = open_promise;
  }

  const conn = await conn_promise;
  if (!conn) {
    context.timed_out = true;
    throw new TimeoutError('Failed to connect within ' + timeout + ' ms');
  }

  clearTimeout(context.timer);
  return conn;
}

export class TimeoutError extends Error {
  constructor(message) {
    super(message);
  }
}

function create_timeout_promise(context) {
  return new Promise(resolve => {
    context.timer = setTimeout(resolve, context.timeout);
  });
}

function create_open_promise(context) {
  return new Promise((resolve, reject) => {
    context.console.debug('Connecting to database', context.name);
    let blocked = false;
    const request = indexedDB.open(context.name, context.version);
    request.onsuccess = function(event) {
      const conn = event.target.result;
      if (blocked) {
        context.console.debug(
            'Closing connection %s that unblocked', conn.name);
        conn.close();
      } else if (context.timed_out) {
        context.console.debug(
            'Closing connection %s opened after timeout', conn.name);
        conn.close();
      } else {
        context.console.debug('Connected to database', conn.name);
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

export function idb_remove(name, console = null_console) {
  return new Promise((resolve, reject) => {
    console.debug('Deleting database', name);
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = resolve;
    request.onerror = () => reject(request.error);
  });
}
