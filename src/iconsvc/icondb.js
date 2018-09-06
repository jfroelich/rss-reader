// NOTE: this is part of a new approach, see the notes at top of iconsvc for
// details
// NOTES:
// * this module is private to the iconsvc. the only consumers of this module
// should be iconsvc, and maybe some local tests
// * the previous impl relied heavily on helper libraries, this should be
// standalone
// * this will be strongly tied to indexedDB, not trying to abstract it away
// entirely
// * the new lookup functionality will be origin-specific, not page-url
// specific, so that the object store will be substantially smaller
// * this is not tied to the reader app's configuration approach or anything
// this is supposed to be nearly or fully standalone


// CURRENT MAIN FOCUS: I've reached a stopping point because I have run into
// the first dilemma. This code is nearly fully redundant with the open
// helper provided by the indexeddb.js library. This feels really dumb to
// re-implement. It is a code reuse problem. The thing is, indexeddb.js is not
// a service. My goal of having services only depend on other services and not
// shared libraries is not great because of this reason. indexeddb.js should
// basically be a shared library. exactly like it is now, prior to this approach
// being implemented. so this service-oriented approach feels really awkward
// and just plain incorrect and makes me want to stop and revisit the primary
// design. I want the favicon service to be standalone, but at the same time,
// I don't want to reimplement common things like assert.js and indexeddb.js
// because it just feels dumb.

// there is a second and related issue regarding the
// separation of library code from application glue code. iconsvc is located
// in the app glue area outside of the library area. this makes it feel like
// the distinction between the two is artificial and dumb.

// I should not proceed until I think about this stuff more.

// https://blog.philipphauer.de/dont-share-libraries-among-microservices/
// https://www.infoq.com/news/2016/02/services-distributed-monolith

// I think i want to go with a shared lib. moreover, i think grouping open
// and remove together in indexeddb.js was a mistake. i want a single shared
// module, called indexeddb-open.js. this hsould be in its own folder, with
// its own tests and documentation. this will be outside of lib, because i
// should do away with the lib folder, because the distinction is dumb to
// enforce by folder and better to enforce by convention (share generic libs,
// not app logic).

// Since this depends on that, I should not be working on this. instead i should
// be working on that, indexeddb-open.js with its own tests and documentation.
// I should do that, then give up on this entirely, instead just keep some
// notes. i think what i want is a src folder full of sub folders, one folder
// for each independent module, where some modules are app-specific and some
// are generic. i don't mean that i should give up on refactoring favicon
// service. i still want to break it into two files, one for the db and one
// for the api. and i want to simplify the api and do away with the object, and
// i want to change to origin-based caching


// Open a connection to the database
// TODO: test
export async function open(name, version, timeout) {
  assert(typeof name === 'string' && name, 'Invalid database name ' + name);
  assert(is_valid_version(version), 'Invalid version ' + version);
  assert(is_valid_timeout(timeout), 'Invalid timeout ' + timeout);

  let timed_out = false;
  let conn_promise;
  let timeout_timer;

  const open_promise = new Promise((resolve, reject) => {
    let blocked = false;
    const request = indexedDB.open(name, version);
    request.onsuccess = function(event) {
      const conn = event.target.result;
      // only resolve if non-blocked and not timed out. if we blocked the
      // promise already rejected so the resolution would be pointless. if we
      // timed out then leave the promise forever unsettled. in either error
      // case we do cleanup by closing the conn.
      if (blocked) {
        conn.close();
      } else if (timed_out) {
        conn.close();
      } else {
        resolve(conn);
      }
    };

    request.onblocked = function(event) {
      blocked = true;
      reject(new BlockError('Connection blocked to database ' + name));
    };

    request.onerror = _ => reject(request.error);
    request.onupgradeneeded = upgrade_handler;
  });

  // If a timeout is specified, then race the open promise against a timeout
  // promise. Otherwise just alias the open promise.
  if (timeout) {
    const to_promise = new Promise(resolve => {
      timeout_timer = setTimeout(resolve, timeout);
    });
    conn_promise = Promise.race([open_promise, to_promise]);
  } else {
    conn_promise = open_promise;
  }

  // Wait for either the database to open or for the timeout to occur, whichever
  // is faster. This also translates open rejections into exceptions
  const conn = await conn_promise;

  // conn is only undefined when the timeout promise won the race
  if (!conn) {
    // signal to the non-canceled open promise that a timeout occurred so that
    // it can appropriately react if and when it later reaches a success state
    // and can appropriately then close the unused connection
    timed_out = true;
    throw new TimeoutError('Failed to connect within ' + timeout + ' ms');
  }

  // If we opened before the timeout elapsed, cancel the timeout. This is
  // slightly superfluous but it is better to release resources asap.
  clearTimeout(timeout_timer);

  return conn;
}

function upgrade_handler(event) {
  const req = event.target;
  const conn = req.result;

  let store;
  if (event.oldVersion < 1) {
    store = conn.createObjectStore('entries', {keyPath: 'origin'});
  } else {
    store = req.transaction.objectStore('entries');
  }

  if (event.oldVersion < 2) {
    store.createIndex('dateUpdated', 'dateUpdated');
  }
}

function is_valid_version(version) {
  return version === undefined || version === null ||
      (Number.isInteger(version) && version >= 0);
}

function is_valid_timeout(timeout) {
  return timeout === undefined || timeout === null ||
      (Number.isInteger(timeout) && timeout >= 0);
}

// Remove all entries from the database
export function clear(conn) {
  // TODO: implement
}

// Delete the database
export function remove(name) {
  // TODO: implement
}

// Compact the given database by removing older entries
export function compact(conn) {
  // TODO: implement
}

// Looks in the given database for an entry with the given url
export function find_entry(conn, url) {
  // TODO: implement
}

// Add or update an entry in the database
export function put_entry(conn, entry) {
  // TODO: implement
}

export class TimeoutError extends Error {
  constructor(message) {
    super(message);
  }
}

export class BlockError extends Error {
  constructor(message) {
    super(message);
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new AssertionError(message);
  }
}

class AssertionError extends Error {
  constructor(message = 'Assertion error') {
    super(message);
  }
}
