// See license.md

'use strict';

function unsubscribe(feed_id, log = SilentConsole) {
  return new Promise(unsubscribe_impl.bind(undefined, feed_id, log));
}

async function unsubscribe_impl(feed_id, log, resolve, reject) {
  if(!Number.isInteger(feed_id) || feed_id < 1) {
    reject(new TypeError());
    return;
  }

  log.log('Unsubscribing from feed with id', feed_id);
  let conn = null;
  try {
    conn = await db_connect(undefined, log);
    let ndeleted = await db_delete_feed_and_entries(conn, feed_id, log);
    log.debug('Deleted %d entries with feed id', ndeleted, feed_id);
    resolve(ndeleted);
  } catch(error) {
    reject(error);
  } finally {
    if(conn)
      conn.close();
  }
}

function db_delete_feed_and_entries(conn, feed_id, log) {
  return new Promise(db_delete_feed_and_entries_impl.bind(undefined, conn,
    feed_id, log));
}

function db_delete_feed_and_entries_impl(conn, feed_id, log, resolve, reject) {
  const chan = new BroadcastChannel('db');
  let num_entries_deleted = 0;
  const tx = conn.transaction(['feed', 'entry'], 'readwrite');
  tx.oncomplete = function(event) {
    chan.close();
    log.debug('Deleted feed and entries for feed id', feed_id);
    if(num_entries_deleted)
      update_badge(conn, log);
    resolve(num_entries_deleted);
  };
  tx.onabort = function(event) {
    chan.close();
    reject(event.target.error);
  };

  log.debug('Deleting feed', feed_id);
  const feed_store = tx.objectStore('feed');
  const feed_request = feed_store.delete(feed_id);
  feed_request.onsuccess = function(event) {
    log.debug('Deleted feed', feed_id);
  };
  feed_request.onerror = function(event) {
    log.debug(event.target.error);
  };
  const entry_store = tx.objectStore('entry');
  const feed_index = entry_store.index('feed');
  const cursor_request = feed_index.openCursor(feed_id);
  cursor_request.onsuccess = function(event) {
    const cursor = event.target.result;
    if(cursor) {
      const entry = cursor.value;
      log.debug('Deleting entry', entry.id, get_entry_url(entry));
      cursor.delete();
      num_entries_deleted++;
      chan.postMessage({'type': 'delete_entry_request', 'id': entry.id});
      cursor.continue();
    }
  };
  cursor_request.onerror = function(event) {
    log.debug(event.target.error);
  };
}
