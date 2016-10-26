// See license.md

'use strict';

// TODO: return a promise
// TODO: use async

{

function unsubscribe(feed_id, log, callback) {
  if(!Number.isInteger(feed_id) || feed_id < 1)
    throw new TypeError(`Invalid feed id ${feed_id}`);
  log.log('Unsubscribing from feed with id', feed_id);
  const ctx = {
    'feed_id': feed_id,
    'num_entries_deleted': 0,
    'callback': callback,
    'log': log,
    'did_delete_feed': false
  };

  ctx.dbChannel = new BroadcastChannel('db');

  const connectPromise = db_connect(undefined, log).then(
    connect_on_success.bind(ctx)).catch(
      on_complete.bind(ctx));
}

function connect_on_success(conn) {
  this.log.debug('Connected to database', conn.name);
  this.conn = conn;

  const tx = this.conn.transaction(['feed', 'entry'], 'readwrite');
  tx.oncomplete = on_complete.bind(this);
  this.log.debug('Deleting feed', this.feed_id);
  const feed_store = tx.objectStore('feed');
  const delete_feed_request = feed_store.delete(this.feed_id);
  delete_feed_request.onsuccess = delete_feed_on_success.bind(this);
  delete_feed_request.onerror = delete_feed_on_error.bind(this);
  const entry_store = tx.objectStore('entry');
  const feed_index = entry_store.index('feed');
  const open_cursor_request = feed_index.openCursor(this.feed_id);
  open_cursor_request.onsuccess = open_entry_cursor_on_success.bind(this);
  open_cursor_request.onerror = open_entry_cursor_on_error.bind(this);
}

function delete_feed_on_success(event) {
  this.did_delete_feed = true;
  this.log.debug('Deleted feed', this.feed_id);
}

function delete_feed_on_error(event) {
  this.log.error(event.target.error);
}

function open_entry_cursor_on_success(event) {
  const cursor = event.target.result;
  if(cursor) {
    const entry = cursor.value;
    this.log.debug('Deleting entry', entry.id, get_entry_url(entry));
    cursor.delete();
    this.num_entries_deleted++;

    this.dbChannel.postMessage(
      {'type': 'delete_entry_request', 'id': entry.id});

    cursor.continue();
  }
}

function open_entry_cursor_on_error(event) {
  this.log.error(event.target.error);
}

function on_complete(event) {
  this.log.log('Completed unsubscribe');

  if(this.conn) {
    if(this.num_entries_deleted) {
      this.log.debug('Requested %i entries to be deleted',
        this.num_entries_deleted);
      update_badge(this.conn, this.log);
    }

    this.log.debug('Closing database', this.conn.name);
    this.conn.close();
  }

  if(this.callback) {
    const type = this.did_delete_feed ? 'success' : 'error';
    const output_event = {
      'type': type,
      'deleteRequestCount': this.num_entries_deleted
    };
    this.callback(output_event);
  }
}

this.unsubscribe = unsubscribe;

}
