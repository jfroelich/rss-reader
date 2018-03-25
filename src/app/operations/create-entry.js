import {entry_is_valid, entry_sanitize, ENTRY_STATE_UNARCHIVED, ENTRY_STATE_UNREAD, is_entry} from '/src/app/objects/entry.js';
import {update_entry} from '/src/app/operations/update-entry.js';
import * as object from '/src/object/object.js';

export async function create_entry(conn, channel, entry) {
  assert(is_entry(entry));
  assert(!('id' in entry) || entry.id === null || entry.id === void 0);

  // Validate
  assert(entry_is_valid(entry));

  // TODO: if I plan to have validation also occur in entry_sanitize, then
  // I think what should happen here is that I pass a no-revalidate flag along
  // to avoid revalidation because it could end up being a heavier operation

  const sanitized_entry = entry_sanitize(entry);
  const storable_entry = object.filter_empty_properties(sanitized_entry);

  // TODO: is it correct to have this be concerned with state initialization,
  // or should it be a responsibility of something earlier in the pipeline? I
  // revised put so that it does no property modification, because I don't like
  // the idea of implicit modification, and was trying to be more transparent.
  // That required all callers to set dateUpdated and increased inconvenience,
  // but it was overall good. Should I apply the same idea here?

  storable_entry.readState = ENTRY_STATE_UNREAD;
  storable_entry.archiveState = ENTRY_STATE_UNARCHIVED;
  storable_entry.dateCreated = new Date();

  // update_entry stores the value as is, and will not automatically add a
  // dateUpdated property, so this is sensible. New entries have never been
  // dirtied, and therefore should not have a date updated. Alternatively, this
  // could even throw an error. For the time being, it is more convenient to
  // just correct invalid input rather than reject it.
  delete storable_entry.dateUpdated;

  // TODO: I plan to add validate to put. I think in this case I need to pass
  // along a parameter that avoids duplicate validation. Here is where I would
  // do something like set validate = false;

  // Delegate the database work to put, because put can be used for both add and
  // put, and the two operations are nearly identical. However, do not supply
  // the input channel, so that its message is suppressed, so that add can send
  // its own message as a substitute. Rethrow any put errors as add errors.
  let void_channel;
  const entry_id = await update_entry(conn, void_channel, storable_entry);

  // Send our own message as a substitute for put's message
  if (channel) {
    channel.postMessage({type: 'entry-added', id: entry_id});
  }
  storable_entry.id = entry_id;
  return storable_entry;
}

function assert(value) {
  if (!value) throw new Error('Assertion error');
}
