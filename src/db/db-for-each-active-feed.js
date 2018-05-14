// TODO: rename to find-active-feeds, it is ok to keep this api style of using
// a handler callback function

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
  // console.debug('Transaction completed');
  callback();
}
