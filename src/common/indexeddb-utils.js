// Opens a connection to an indexedDB database. The important additions to the
// normal functionality of indexedDB.open are that you can specify a timeout
// after which to consider the connection a failure, and that a blocked
// connection is treated implicitly as an error.
export async function open(name, version, upgradeListener, timeout) {
  if (typeof name !== 'string') {
    throw new TypeError('Invalid name ' + name);
  }

  if (!isNaN(timeout) && (!Number.isInteger(timeout) || timeout < 0)) {
    throw new TypeError('Invalid timeout ' + timeout);
  }

  const context = {
    name: name,
    version: version,
    upgradeListener: upgradeListener,
    timeout: timeout,
    timedout: false
  };

  const openPromise = createOpenPromise(context);
  const contestants = [openPromise];

  if (timeout) {
    const timeoutPromise = createTimeoutPromise(context);
    contestants.push(timeoutPromise);
  }

  const conn = await Promise.race(contestants);
  if (!conn) {
    context.timedout = true;
    throw new Error('Connection timed out');
  }

  clearTimeout(context.timer);
  return conn;
}

function createTimeoutPromise(context) {
  return new Promise(resolve => {
    context.timer = setTimeout(resolve, context.timeout);
  });
}

function createOpenPromise(context) {
  return new Promise((resolve, reject) => {
    console.debug('Connecting to database', context.name);
    let blocked = false;
    const request = indexedDB.open(context.name, context.version);
    request.onsuccess = function(event) {
      const conn = event.target.result;
      if (blocked) {
        console.debug('Closing connection %s that unblocked', conn.name);
        conn.close();
      } else if (context.timedout) {
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
    // here with a function that first checks if blocked/timedout and if so
    // aborts the transaction and closes, otherwise forwards to the listener.
    request.onupgradeneeded = context.upgradeListener;
  });
}
