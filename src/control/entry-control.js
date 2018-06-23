import {assert} from '/src/assert.js';
import {ReaderDAL} from '/src/dal.js';
import * as Entry from '/src/data-layer/entry.js';
import {replace_tags} from '/src/html/replace-tags.js';
import {truncate_html} from '/src/html/truncate-html.js';
import {condense_whitespace} from '/src/lang/condense-whitespace.js';
import {filter_control_characters} from '/src/lang/filter-control-characters.js';
import {filter_unprintable_characters} from '/src/lang/filter-unprintable-characters.js';

export function mark_entry_read(conn, channel, entry_id) {
  return new Promise((resolve, reject) => {
    assert(Entry.is_valid_entry_id(entry_id));
    const txn = conn.transaction('entry', 'readwrite');
    txn.oncomplete = _ => {
      channel.postMessage({type: 'entry-read', id: entry_id});
      resolve();
    };
    txn.onerror = _ => reject(txn.error);

    const store = txn.objectStore('entry');
    const request = store.get(entry_id);
    request.onsuccess = _ => {
      const entry = request.result;
      assert(Entry.is_entry(entry));
      // Once an entry enters the archive state, it should require direct
      // property access to manipulate read state, so prevent access here. This
      // helper is only intended for use on unarchived entries
      assert(entry.archiveState !== Entry.ENTRY_STATE_ARCHIVED);
      assert(entry.readState !== Entry.ENTRY_STATE_READ);

      entry.readState = Entry.ENTRY_STATE_READ;
      const currentDate = new Date();
      entry.dateUpdated = currentDate;
      entry.dateRead = currentDate;

      request.source.put(entry);
    };
  });
}


// Removes entries missing urls from the database
// TODO: test
export async function remove_lost_entries(dal) {
  const deleted_entry_ids = [];
  const txn_writable = true;
  await dal.iterateEntries('all', txn_writable, cursor => {
    const entry = cursor.value;
    if (!entry.urls || !entry.urls.length) {
      cursor.delete();
      deleted_entry_ids.push(entry.id);
    }
  });

  for (const id of deleted_entry_ids) {
    channel.postMessage({type: 'entry-deleted', id: id, reason: 'lost'});
  }
}

export function sanitize_entry(
    entry, author_max_length = 200, title_max_length = 1000,
    content_max_length = 50000) {
  const blank_entry = Entry.create_entry();
  const output_entry = Object.assign(blank_entry, entry);

  if (output_entry.author) {
    let author = output_entry.author;
    author = filter_control_characters(author);
    author = replace_tags(author, '');
    author = condense_whitespace(author);
    author = truncate_html(author, author_max_length);
    output_entry.author = author;
  }

  if (output_entry.content) {
    let content = output_entry.content;
    content = filter_unprintable_characters(content);
    content = truncate_html(content, content_max_length);
    output_entry.content = content;
  }

  if (output_entry.title) {
    let title = output_entry.title;
    title = filter_control_characters(title);
    title = replace_tags(title, '');
    title = condense_whitespace(title);
    title = truncate_html(title, title_max_length);
    output_entry.title = title;
  }

  return output_entry;
}
