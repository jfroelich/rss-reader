import {console_stub} from '/src/lib/console-stub/console-stub.js';
import {filter_empty_properties} from '/src/lib/object/object.js';
import {entry_is_valid, entry_sanitize, ENTRY_STATE_UNARCHIVED, ENTRY_STATE_UNREAD, is_entry} from '/src/objects/entry.js';
import {update_entry} from '/src/operations/update-entry.js';

export async function create_entry(
    conn, channel = null_channel, console = console_stub, entry) {
  if (!is_entry(entry)) {
    throw new TypeError('entry argument is not an entry object: ' + entry);
  }

  if ('id' in entry) {
    throw new TypeError(
        'Unexpected inline key-path found in entry object: ' + entry);
  }

  if (!entry_is_valid(entry)) {
    throw new TypeError('entry object has invalid properties: ' + entry);
  }

  const sanitized_entry = entry_sanitize(entry);
  const storable_entry = filter_empty_properties(sanitized_entry);

  // Setup or remove initial values
  storable_entry.readState = ENTRY_STATE_UNREAD;
  storable_entry.archiveState = ENTRY_STATE_UNARCHIVED;
  storable_entry.dateCreated = new Date();
  delete storable_entry.dateUpdated;

  const entry_id = await update_entry(conn, void channel, storable_entry);

  channel.postMessage({type: 'entry-added', id: entry_id});

  console.log('Created entry in database %s with new id', conn.name, entry_id);

  storable_entry.id = entry_id;
  return storable_entry;
}

function noop() {}

const null_channel = {
  name: 'null-channel',
  postMessage: noop,
  close: noop
};
