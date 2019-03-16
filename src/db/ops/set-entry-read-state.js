import {assert} from '/src/assert.js';
import {InvalidStateError, NotFoundError} from '/src/db/errors.js';
import {Entry, is_entry} from '/src/db/types/entry.js';

// Modify the read state property of an entry in the database. |id| is id of
// entry in database to modify. |read| is boolean, true if marking as read,
// false if marking as unread, defaults to false.
export default function set_entry_read_state(conn, channel, id, read = false) {
  return new Promise((resolve, reject) => {
    assert(Entry.isValidId(id));
    assert(typeof read === 'boolean');
    const txn = conn.transaction('entry', 'readwrite');
    txn.onerror = event => reject(event.target.error);
    txn.oncomplete = event => {
      if (channel) {
        channel.postMessage({type: 'entry-updated', id: id, read: read});
      }

      resolve();
    };
    const store = txn.objectStore('entry');
    const request = store.get(id);
    request.onsuccess = function(event) {
      const entry = event.target.result;

      if (!entry) {
        const message = 'No entry found with id ' + id;
        const error = new NotFoundError(message);
        reject(error);
        return;
      }

      if (!is_entry(entry)) {
        const message = 'Matched object is not an entry ' + id;
        const error = new TypeError(message);
        reject(error);
        return;
      }

      if (entry.archiveState === Entry.ARCHIVED) {
        const message = 'Cannot change read state of archived entry ' + id;
        const error = new InvalidStateError(message);
        reject(error);
        return;
      }

      if (read && entry.readState === Entry.READ) {
        const message = 'Cannot mark read entry as read ' + id;
        const error = new InvalidStateError(message);
        reject(error);
        return;
      } else if (!read && entry.readState === Entry.UNREAD) {
        const message = 'Cannot mark unread entry as unread ' + id;
        const error = new InvalidStateError(message);
        reject(error);
        return;
      }

      entry.readState = read ? Entry.READ : Entry.UNREAD;
      const currentDate = new Date();
      entry.dateUpdated = currentDate;
      if (read) {
        entry.dateRead = currentDate;
      } else {
        delete entry.dateRead;
      }

      event.target.source.put(entry);
    };
  });
}