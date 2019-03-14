import {assert} from '/src/assert.js';
import {Entry, is_entry} from '/src/model/types/entry.js';
import filter_empty_properties from '/src/model/utils/filter-empty-properties.js';

export default function create_entry(conn, entry) {
  return new Promise((resolve, reject) => {
    assert(is_entry(entry));
    assert(entry.id === undefined);

    if (entry.readState === undefined) {
      entry.readState = Entry.UNREAD;
    }

    if (entry.archiveState === undefined) {
      entry.archiveState = Entry.UNARCHIVED;
    }

    if (entry.dateCreated === undefined) {
      entry.dateCreated = new Date();
    }

    // All entries need to appear in the datePublished index
    if (entry.datePublished === undefined) {
      entry.datePublished = entry.dateCreated;
    }

    delete entry.dateUpdated;
    filter_empty_properties(entry);

    let id;
    const txn = conn.conn.transaction('entry', 'readwrite');
    txn.oncomplete = _ => {
      conn.channel.postMessage({type: 'entry-created', id: id});
      resolve(id);
    };
    txn.onerror = event => reject(event.target.error);
    const store = txn.objectStore('entry');
    const request = store.put(entry);
    request.onsuccess = _ => id = request.result;
  });
}
