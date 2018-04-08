import {filter_empty_properties} from '/src/lib/object/object.js';
import {entry_is_valid, entry_sanitize, ENTRY_STATE_UNARCHIVED, ENTRY_STATE_UNREAD, is_entry} from '/src/objects/entry.js';
import {update_entry} from '/src/ops/update-entry.js';

export async function rdr_create_entry(entry, validate) {
  if (!is_entry(entry)) {
    throw new TypeError('entry argument is not an entry object: ' + entry);
  }

  if ('id' in entry) {
    throw new TypeError(
        'Unexpected inline key-path found in entry object: ' + entry);
  }

  if (validate && !entry_is_valid(entry)) {
    throw new TypeError('entry object is invalid: ' + entry);
  }

  const sanitized_entry = entry_sanitize(entry);
  const storable_entry = filter_empty_properties(sanitized_entry);

  // Setup or remove initial values
  storable_entry.readState = ENTRY_STATE_UNREAD;
  storable_entry.archiveState = ENTRY_STATE_UNARCHIVED;
  storable_entry.dateCreated = new Date();
  delete storable_entry.dateUpdated;

  const entry_id = await update_entry(this.conn, void channel, storable_entry);

  this.channel.postMessage({type: 'entry-added', id: entry_id});

  this.console.log('Created entry', entry_id);
  storable_entry.id = entry_id;
  return storable_entry;
}
