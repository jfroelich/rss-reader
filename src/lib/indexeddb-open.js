import {console_stub} from '/src/lib/console-stub.js';

// This function opens a connection to an indexedDB database. The important
// additions to the normal functionality of indexedDB.open are that you
// can optionally specify a timeout after which to consider the connection a
// failure, and that a blocked connection is treated as an error (and the
// connection is automatically closed should it ever open later).
//
// An upgrade can still happen in the event of a rejection. I am not trying to
// prevent that as an implicit side effect, although it is possible to abort the
// versionchange transaction from within the upgrade listener. If I wanted to do
// that I would wrap the call to the listener here with a function that first
// checks if blocked/timed_out and if so aborts the transaction and closes,
// otherwise forwards to the listener.

function idb_context_t() {
  this.name = null;
  this.version = null;
  this.upgrade_listener = null;
  this.timeout = NaN;
  this.timed_out = false;
  this.timer = null;
  this.console = console_stub;
}

export async function indexeddb_open(
    name, version, upgrade_listener, timeout, console = console_stub) {
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
  context.console = console;

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

export class BlockError extends Error {
  constructor(message = 'Connection blocked') {
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
      reject(new BlockError());
    };

    request.onerror = () => reject(request.error);
    request.onupgradeneeded = context.upgrade_listener;
  });
}
