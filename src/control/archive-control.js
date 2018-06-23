import {sizeof} from '/src/lang/sizeof.js';
import * as Entry from '/src/data-layer/entry.js';
import * as entry_control from '/src/control/entry-control.js';
import {ReaderDAL} from '/src/dal.js';

const TWO_DAYS_MS = 1000 * 60 * 60 * 24 * 2;

// Compacts older read entries in the database. Dispatches entry-archived
// messages once the internal transaction completes. max_age is in ms, optional,
// defaults to two days, how old an entry must be in order to archive it.
export async function archive_entries(conn, channel, max_age = TWO_DAYS_MS) {
  const entry_ids = [];
  const txn_writable = true;

  const dal = new ReaderDAL();
  dal.conn = conn;

  await dal.iterateEntries('archive', txn_writable, cursor => {
    const entry = cursor.value;
    if (!Entry.is_entry(entry)) {
      console.warn('Bad entry read from db', entry);
      return;
    }

    if (!entry.dateCreated) {
      console.warn('Entry missing date created', entry);
      return;
    }

    const current_date = new Date();
    const age = current_date - entry.dateCreated;

    if (age < 0) {
      console.warn('Entry created in future', entry);
      return;
    }

    if (age > max_age) {
      const ae = archive_entry(entry);
      cursor.update(ae);
      entry_ids.push(ae.id);
    }
  });

  for (const id of entry_ids) {
    channel.postMessage({type: 'entry-archived', id: id});
  }
}

function archive_entry(entry) {
  const before_size = sizeof(entry);
  const ce = compact_entry(entry);
  const after_size = sizeof(ce);

  if (after_size > before_size) {
    console.warn('Entry increased size', entry);
  }

  ce.archiveState = Entry.ENTRY_STATE_ARCHIVED;
  const current_date = new Date();
  ce.dateArchived = current_date;
  ce.dateUpdated = current_date;
  return ce;
}

function compact_entry(entry) {
  const ce = Entry.create_entry();
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
