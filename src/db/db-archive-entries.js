import {create_entry, ENTRY_STATE_ARCHIVED, ENTRY_STATE_READ, ENTRY_STATE_UNARCHIVED} from '/src/entry.js';
import {sizeof} from '/src/lib/lang/sizeof.js';

/*

## archive-entries
Async. Scans the entry store for older entries and archives them. This is an
alternative to deleting older entries so as to keep information about which
entries have been seen before, and for various statistics. Archiving replaces an
entry object with a compacted version, where several properties are removed or
reduced in size.

### Context properties
* **conn** {IDBDatabase} an open database connection to the reader database
* **channel** {BroadcastChannel} an open channel to which to post messages
* **console** {console-like-object} logging destination

All context properties are required

### Params
* **max_age** {Number} in milliseconds, optional, defaults to two days, how old
an entry must be based on the difference between the run time and the date the
entry was created in order to consider the entry as archivable

### Errors
* **TypeError** invalid inputs, such as invalid max-age parameter value
* **DOMException** database errors, such as database not open, database close
pending, transaction failure, store missing
* **InvalidStateError** if the channel is closed at the time messages are sent
to the channel

### Return value
Returns a promise that resolves to an array of entry ids that were archived.

### Channel message format
Messages are basic objects with properties:
* **type** {String} entry-archived
* **id** {Number} entry id

### Implementation note regarding database transactions
* This uses one transaction. Using one transaction ensures data integrity.
* This involves a rather obtrusive lock on the entire database because the
transaction involves writing and is relatively long-running.

### Implementation note regarding how entries are selected
Rather than load only those entries that should be archived, this loads entries
that have some properties needed for archivability but are not necessarily
archivable. This is largely due to the complexities of using a multipart key
path for an index in indexedDB. Therefore this loads more entries than needed. I
may in the future look into optimizing this aspect, and making it more correct.
For now I am leaving it this way given this is intended to run untimed.

### Implementation note on using getAll vs cursor
This uses a cursor to walk entries instead of getAll. While `getAll` is faster,
`getAll` loads the entire store at once, and therefore does not scale. This
operation generally runs in the background so it is not performance sensitive,
but it is still data-size sensitive. Entry objects can be rather large because
of the content field. While using the cursor is slower and involves a ton of
stack calls, it scales better. With the cursor, only a limited number of entry
objects ever reside in memory at any one point in time.

### Implementation note regarding entries presently viewable
Tracking viewable entries is possible but not very feasible. Therefore, this
interacts with a channel. This sends out a message to the channel each time an
entry is archived. If the view also interacts with a channel, it will be
notified that certain entries were archived, and should be able to react
accordingly. The view is better equipped to dynamically determine whether a
given entry resides in the view and decide how to react. Therefore, whether an
entry is currently viewable is not this operation's concern.

### Implementation note regarding messages and transaction state
Channel messages are not posted until *after* the transaction completes
successfully. In other words, messages are not posted prematurely and do not
assume the transaction will be successful, to avoid having callers develop a
false reliance on the state of the database. Posting a message to the channel
may cause an invalid state error if the channel is closed. This will cause the
operation to reject with an error. However, by this point the transaction was
committed. Therefore it is possible for this function to throw an error yet
still permanently modify state.

### Implementation note regarding batch message posting
This sends one message to the channel per entry archived, rather than sending a
single message containing an array of archived entry ids. The number of archived
entries can be very large. Sending very large messages is discouraged. This
assumes that BroadcastChannels are better tuned for sending a large number of
small messages than a small number of large messages.
*/

const TWO_DAYS_MS = 1000 * 60 * 60 * 24 * 2;

export function db_archive_entries(max_age = TWO_DAYS_MS) {
  return new Promise(archive_entries_executor.bind(this, max_age));
}

function archive_entries_executor(max_age, resolve, reject) {
  this.console.log('%s: starting', db_archive_entries.name);
  const entry_ids = [];
  const txn = this.conn.transaction('entry', 'readwrite');
  txn.onerror = _ => reject(txn.error);
  txn.oncomplete = txn_oncomplete.bind(this, entry_ids, resolve);

  const store = txn.objectStore('entry');
  const index = store.index('archiveState-readState');
  const key_path = [ENTRY_STATE_UNARCHIVED, ENTRY_STATE_READ];
  const request = index.openCursor(key_path);
  request.onsuccess = request_onsuccess.bind(this, entry_ids, max_age);
}

// TODO: check that loaded entry is_entry
// TODO: use early returns, less nesting
function request_onsuccess(entry_ids, max_age, event) {
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

function txn_oncomplete(entry_ids, callback, event) {
  this.console.debug(
      '%s: archived %d entries', db_archive_entries.name, entry_ids.length);

  const channel = this.channel;
  const msg = {type: 'entry-archived', id: 0};
  for (const id of entry_ids) {
    msg.id = id;
    channel.postMessage(msg);
  }

  callback();
}

function archive_entry(console, entry) {
  const before_sz = sizeof(entry);
  const ce = compact_entry(entry);
  const after_sz = sizeof(ce);

  if (after_sz > before_sz) {
    console.warn('%s: increased entry size %o', db_archive_entries.name, entry);
  }

  console.debug(
      '%s: reduced entry size by ~%d bytes', db_archive_entries.name,
      after_sz - before_sz);
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
