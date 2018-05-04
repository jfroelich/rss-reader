import {create_entry, ENTRY_STATE_ARCHIVED, ENTRY_STATE_READ, ENTRY_STATE_UNARCHIVED, ENTRY_STATE_UNREAD, is_entry, is_valid_entry, is_valid_entry_id, sanitize_entry} from '/src/objects/entry.js';
// TODO: avoid circular dependency
import {refresh_badge} from '/src/ops/refresh-badge.js';
import {sizeof} from '/src/lib/sizeof.js';
import {is_valid_feed_id} from '/src/objects/feed.js';
import {filter_empty_properties} from '/src/lib/object.js';

const TWO_DAYS_MS = 1000 * 60 * 60 * 24 * 2;

export function archive_entries(max_age = TWO_DAYS_MS) {
  return new Promise(archive_entries_executor.bind(this, max_age));
}

function archive_entries_executor(max_age, resolve, reject) {
  this.console.log('Archiving entries...');
  const entry_ids = [];
  const txn = this.conn.transaction('entry', 'readwrite');
  txn.onerror = _ => reject(txn.error);
  txn.oncomplete =
      archive_entries_txn_oncomplete.bind(this, entry_ids, resolve);

  const store = txn.objectStore('entry');
  const index = store.index('archiveState-readState');
  const key_path = [ENTRY_STATE_UNARCHIVED, ENTRY_STATE_READ];
  const request = index.openCursor(key_path);
  request.onsuccess =
      archive_entries_request_onsuccess.bind(this, entry_ids, max_age);
}

function archive_entries_request_onsuccess(entry_ids, max_age, event) {
  const cursor = event.target.result;
  if (cursor) {
    const entry = cursor.value;
    if (entry.dateCreated) {
      const current_date = new Date();
      const age = current_date - entry.dateCreated;
      if (age > max_age) {
        const ae = archive_entry(this.console, entry);
        cursor.update(ae);
        entry_ids.push(ae.id);
      }
    }

    cursor.continue();
  }
}

function archive_entries_txn_oncomplete(entry_ids, callback, event) {
  const channel = this.channel;
  const msg = {type: 'entry-archived', id: 0};
  for (const id of entry_ids) {
    msg.id = id;
    channel.postMessage(msg);
  }

  this.console.debug('Archived %d entries', entry_ids.length);
  callback(entry_ids);
}

function archive_entry(console, entry) {
  const before_sz = sizeof(entry);
  const ce = compact_entry(entry);
  const after_sz = sizeof(ce);

  if (after_sz > before_sz) {
    console.warn('compact_entry increased entry size!', entry);
  }

  console.debug('Reduced entry size by ~%d bytes', after_sz - before_sz);
  ce.archiveState = ENTRY_STATE_ARCHIVED;
  const current_date = new Date();
  ce.dateArchived = current_date;
  ce.dateUpdated = current_date;
  return ce;
}

function compact_entry(entry) {
  const ce = create_entry();
  ce.dateCreated = entry.dateCreated;

  if (entry.dateRead) {
    ce.dateRead = entry.dateRead;
  }

  ce.feed = entry.feed;
  ce.id = entry.id;
  ce.readState = entry.readState;
  ce.urls = entry.urls;
  return ce;
}

// TODO: finish up migration from find_entry_id_by_url
export async function contains_entry(conn, query) {
  if (!(query.url instanceof URL)) {
    throw new TypeError('Invalid query ' + query);
  }

  const id = await find_entry_id_by_url(conn, query.url);
  return is_valid_entry_id(id);
}

// Not exported because only used by contains-entry
function find_entry_id_by_url(conn, url) {
  return new Promise(find_entry_id_by_url_executor.bind(null, conn, url));
}

function find_entry_id_by_url_executor(conn, url, resolve, reject) {
  const context = {entry_id: null, callback: resolve};

  const txn = conn.transaction('entry');
  txn.oncomplete = find_entry_id_by_url_txn_oncomplete.bind(txn, context);
  txn.onerror = _ => reject(txn.error);

  const store = txn.objectStore('entry');
  const index = store.index('urls');
  const request = index.getKey(url.href);
  request.onsuccess =
      find_entry_id_by_url_request_onsuccess.bind(request, context);
}

function find_entry_id_by_url_txn_oncomplete(context, event) {
  context.callback(context.entry_id);
}

function find_entry_id_by_url_request_onsuccess(context, event) {
  context.entry_id = event.target.result;
}

// TODO: use context
export function find_viewable_entries(conn, offset, limit) {
  if (offset !== null && typeof offset !== 'undefined') {
    assert(Number.isInteger(offset) && offset >= 0);
  }

  return new Promise(
      find_viewable_entries_executor.bind(null, conn, offset, limit));
}

function find_viewable_entries_executor(conn, offset, limit, resolve, reject) {
  const entries = [];
  let counter = 0;
  let advanced = false;
  const limited = limit > 0;
  const txn = conn.transaction('entry');
  txn.oncomplete = _ => resolve(entries);
  txn.onerror = _ => reject(txn.error);
  const store = txn.objectStore('entry');
  const index = store.index('archiveState-readState');
  const key_path = [ENTRY_STATE_UNARCHIVED, ENTRY_STATE_UNREAD];
  const request = index.openCursor(key_path);
  request.onsuccess = _ => {
    const cursor = request.result;
    if (cursor) {
      if (offset && !advanced) {
        advanced = true;
        cursor.advance(offset);
      } else {
        entries.push(cursor.value);
        if (limited && ++counter < limit) {
          cursor.continue();
        }
      }
    }
  };
}

// TODO: use context
export function for_each_viewable_entry(conn, offset, limit, callback) {
  return new Promise(for_each_viewable_entry_executor.bind(
      null, conn, offset, limit, callback));
}

function for_each_viewable_entry_executor(
    conn, offset, limit, callback, resolve, reject) {
  let counter = 0;
  let advanced = false;
  const limited = limit > 0;

  const txn = conn.transaction('entry');
  txn.oncomplete = resolve;
  txn.onerror = _ => reject(txn.error);

  const store = txn.objectStore('entry');
  const index = store.index('archiveState-readState');
  const key_path = [ENTRY_STATE_UNARCHIVED, ENTRY_STATE_UNREAD];
  const request = index.openCursor(key_path);
  request.onsuccess = function(event) {
    const cursor = event.target.result;
    if (cursor) {
      if (offset && !advanced) {
        advanced = true;
        cursor.advance(offset);
      } else {
        // Put the request on the stack prior to the callback
        if (limited && ++counter < limit) {
          cursor.continue();
        }

        callback(cursor.value);
      }
    }
  };
}

export function mark_entry_read(entry_id) {
  if (!is_valid_entry_id(entry_id)) {
    throw new TypeError('entry_id is not a valid entry id: ' + entry_id);
  }

  return new Promise(mark_entry_read_executor.bind(this, entry_id));
}

function mark_entry_read_executor(entry_id, resolve, reject) {
  const txn = this.conn.transaction('entry', 'readwrite');
  txn.oncomplete = mark_entry_read_txn_oncomplete.bind(this, entry_id, resolve);
  txn.onerror = _ => reject(txn.error);
  const store = txn.objectStore('entry');
  const request = store.get(entry_id);
  request.onsuccess = mark_entry_read_request_onsuccess.bind(this, entry_id);
}

function mark_entry_read_request_onsuccess(entry_id, event) {
  const entry = event.target.result;
  if (!entry) {
    this.console.warn('No entry found', entry_id);
    return;
  }

  if (!is_entry(entry)) {
    this.console.warn('Invalid matched object type', entry_id, entry);
    return;
  }

  if (entry.readState === ENTRY_STATE_READ) {
    this.console.warn('Entry already read', entry.id);
    return;
  }

  if (entry.readState !== ENTRY_STATE_UNREAD) {
    this.console.warn('Entry not unread', entry.id);
    return;
  }

  entry.readState = ENTRY_STATE_READ;
  const currentDate = new Date();
  entry.dateUpdated = currentDate;
  entry.dateRead = currentDate;

  const entry_store = event.target.source;
  entry_store.put(entry);
}

function mark_entry_read_txn_oncomplete(entry_id, callback, event) {
  this.console.debug('Marked entry as read', entry_id);
  this.channel.postMessage({type: 'entry-marked-read', id: entry_id});
  const conn = event.target.db;
  refresh_badge(conn, this.console).catch(this.console.error);
  callback();
}

export async function remove_lost_entries() {
  return new Promise(remove_lost_entries_executor.bind(this));
}

function remove_lost_entries_executor(resolve, reject) {
  const ids = [];
  const stats = {visited_entry_count: 0};
  const txn = this.conn.transaction('entry', 'readwrite');
  txn.oncomplete =
      remove_lost_entries_txn_oncomplete.bind(this, ids, resolve, stats);
  txn.onerror = _ => reject(txn.error);

  const store = txn.objectStore('entry');
  const request = store.openCursor();
  request.onsuccess =
      remove_lost_entries_request_onsuccess.bind(this, ids, stats);
}

function remove_lost_entries_request_onsuccess(ids, stats, event) {
  const cursor = event.target.result;
  if (cursor) {
    stats.visited_entry_count++;

    const entry = cursor.value;
    if (!entry.urls || !entry.urls.length) {
      this.console.debug(
          '%s: deleting entry %d', remove_lost_entries.name, entry.id);
      cursor.delete();
      ids.push(entry.id);
    }

    cursor.continue();
  }
}

function remove_lost_entries_txn_oncomplete(ids, callback, stats, event) {
  const name = remove_lost_entries.name, scan = stats.visited_entry_count;
  this.console.debug(
      '%s: txn completed, scanned %d, deleted %d', name, scan, ids.length);

  const message = {type: 'entry-deleted', id: 0, reason: 'lost'};
  for (const id of ids) {
    message.id = id;
    this.channel.postMessage(message);
  }

  callback();
}


export function remove_orphaned_entries() {
  return new Promise(remove_orphaned_entries_executor.bind(this));
}

function remove_orphaned_entries_executor(resolve, reject) {
  const entry_ids = [];
  const txn = this.conn.transaction(['feed', 'entry'], 'readwrite');
  txn.oncomplete =
      remove_orphaned_entries_txn_oncomplete.bind(this, entry_ids, resolve);
  txn.onerror = _ => reject(txn.error);

  const feed_store = txn.objectStore('feed');
  const request_get_feed_ids = feed_store.getAllKeys();
  request_get_feed_ids.onsuccess = _ => {
    const feed_ids = request_get_feed_ids.result;

    const entry_store = txn.objectStore('entry');
    const entry_store_cursor_request = entry_store.openCursor();
    entry_store_cursor_request.onsuccess = _ => {
      const cursor = entry_store_cursor_request.result;
      if (cursor) {
        const entry = cursor.value;
        if (!is_valid_feed_id(entry.feed) || !feed_ids.includes(entry.feed)) {
          entry_ids.push(entry.id);
          this.console.debug(
              '%s: deleting entry', remove_orphaned_entries.name, entry.id);
          cursor.delete();
        }

        cursor.continue();
      }
    };
  };
}

function remove_orphaned_entries_txn_oncomplete(entry_ids, callback, event) {
  const message = {type: 'entry-deleted', id: 0, reason: 'orphan'};
  for (const id of entry_ids) {
    message.id = id;
    this.channel.postMessage(message);
  }

  callback(entry_ids);
}

export function write_entry(entry, validate = true) {
  if (!is_entry(entry)) {
    throw new TypeError('entry is not an entry ' + entry);
  }

  return new Promise(write_entry_executor.bind(this, entry, validate));
}

function write_entry_executor(entry, validate, resolve, reject) {
  if (validate && !is_valid_entry(entry)) {
    throw new TypeError('invalid entry ' + entry);
  }

  const is_create = !is_valid_entry_id(entry.id);
  let storable_entry;

  if (is_create) {
    const sanitized_entry = sanitize_entry(entry);
    storable_entry = filter_empty_properties(sanitized_entry);

    storable_entry.readState = ENTRY_STATE_UNREAD;
    storable_entry.archiveState = ENTRY_STATE_UNARCHIVED;
    storable_entry.dateCreated = new Date();
    delete storable_entry.dateUpdated;
  } else {
    storable_entry = entry;
  }

  const txn = this.conn.transaction('entry', 'readwrite');
  txn.oncomplete =
      write_entry_txn_oncomplete.bind(this, storable_entry, is_create, resolve);
  txn.onerror = _ => reject(txn.error);

  const store = txn.objectStore('entry');
  const request = store.put(storable_entry);
  if (is_create) {
    request.onsuccess = event => storable_entry.id = event.target.result;
  }
}

function write_entry_txn_oncomplete(entry, is_create, callback, event) {
  this.channel.postMessage(
      {type: 'entry-write', id: entry.id, 'create': is_create});

  const msg = is_create ? '%s: wrote new entry %d' : '%s: overwrote entry %d';
  this.console.debug(msg, write_entry.name, entry.id);

  callback(entry);
}

function assert(value) {
  if (!value) throw new Error('Assertion error');
}
