import {log} from '/src/log.js';

// TODO: rename to find-active-feeds, it is ok to keep this api style of using
// a handler callback function

// TODO: actually merge it into find-feeds, with an is-active parameter to the
// query

// Async. Queries the database for active feeds and then calls the `handle_feed`
// function argument on each feed. The handler function is called *during*
// iteration over the feeds in the database as each feed is visited; not later.
// Completes when iteration over the feeds in the database completes. *Iteration
// may complete prior to all handlers completing*. In other words, iteration
// over the feeds can complete while one or more handlers are pending.

// ### Params
// * **conn** {IDBDatabase} an open database connection to the feed database
// * **handle_feed** {Function} called for each active feed with the
// deserialized feed object as its sole argument, the function should be
// synchronous and pure (free of side effects, at least persistent state
// changing ones)

// ### Return value
// Returns a promise. The return value of the promise itself is undefined, or at
// least, the return value of the promise should be ignored.

// ### TODOS
// * Refactor db-get-feeds as for-each-feed, have for-each-feed accept a
// predicate parameter, then remove the implementation here and have it simply
// decorate a call to for-each-feed with a feed-is-active predicate, or have the
// caller just call for-each-feed directly and deprecate this operation
// * Eventually, consider using an index on active to speed this up. I am not at
// the moment because I do not think there is much of a speed increase, and
// prefer not to use an index unless there is a material performance benefit
// * consider a limit parameter that applies to number of active feeds evaluated

export function db_for_each_active_feed(conn, handle_feed) {
  return new Promise(executor.bind(null, conn, handle_feed));
}

function executor(conn, handle_feed, resolve, reject) {
  const txn = conn.transaction('feed');
  txn.oncomplete = txn_oncomplete.bind(txn, resolve);
  txn.onerror = _ => reject(txn.error);

  const store = txn.objectStore('feed');
  const request = store.openCursor();
  request.onsuccess = request_onsuccess.bind(request, handle_feed);
}

function request_onsuccess(handle_feed, event) {
  const cursor = event.target.result;
  if (cursor) {
    const feed = cursor.value;

    // Because handle_feed is sync, continue before its evaluation. Here
    // continue doesn't actually break (exit early), it merely schedules the
    // cursor to advance. The cursor will advance at the earliest in the next
    // tick (the next iteration of the event loop). Otherwise, continuing after
    // the handler completes could introduce an artificial delay.
    cursor.continue();

    if (feed.active) {
      handle_feed(feed);
    }
  }
}

function txn_oncomplete(callback, event) {
  // log('Transaction completed');
  callback();
}
