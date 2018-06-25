import assert from '/src/lib/assert.js';
import * as Model from '/src/model.js';
import sizeof from '/src/lib/sizeof.js';

const TWO_DAYS_MS = 1000 * 60 * 60 * 24 * 2;

// Compacts older read entries in the database. Dispatches entry-archived
// messages once the internal transaction completes. max_age is in ms, optional,
// defaults to two days, how old an entry must be in order to archive it.
export async function archive_entries(dal, max_age = TWO_DAYS_MS) {
  const entry_ids = [];
  const txn_writable = true;

  await dal.iterateEntries('archive', txn_writable, cursor => {
    const entry = cursor.value;
    assert(Model.is_entry(entry));
    assert(entry.dateCreated);

    const current_date = new Date();
    const age = current_date - entry.dateCreated;
    assert(age >= 0);

    if (age > max_age) {
      const ae = archive_entry(entry);
      cursor.update(ae);
      entry_ids.push(ae.id);
    }
  });

  for (const id of entry_ids) {
    dal.channel.postMessage({type: 'entry-archived', id: id});
  }
}

function archive_entry(entry) {
  const before_size = sizeof(entry);
  const ce = compact_entry(entry);
  const after_size = sizeof(ce);

  if (after_size > before_size) {
    console.warn('Entry increased size', entry);
  }

  ce.archiveState = Model.ENTRY_STATE_ARCHIVED;
  const current_date = new Date();
  ce.dateArchived = current_date;
  ce.dateUpdated = current_date;
  return ce;
}

function compact_entry(entry) {
  const ce = Model.create_entry();
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
