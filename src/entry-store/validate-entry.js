import {is_entry, is_valid_entry_id} from '/src/entry-store/entry.js';

// TODO: the problem now is that I have no idea of what causes invalidity
// outside of logging something. I need to distinguish between the reasons
// something is invalid. Maybe return a code, 0 being valid, -1 being invalid
// reason #1, -2 being invalid reason #2, etc. Or maybe implement as a void
// function that throws exceptions, even though these are not programming errors

// Returns whether an entry is valid
// NOTE: only partially implemented
export function validate_entry(entry) {
  if (!is_entry(entry)) {
    return false;
  }

  // This could be called on a new entry that does not have an id, so only
  // check id validity when the property exists
  if ('id' in entry) {
    if (!is_valid_entry_id(entry.id)) {
      console.debug('%s: invalid id', validate_entry.name, entry.id);
      return false;
    }
  }

  return true;
}
