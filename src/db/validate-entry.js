import {is_entry, is_valid_entry_id} from '/src/entry.js';

// Returns whether an entry is valid. Only partially implemented
export function validate_entry(entry) {
  if (!is_entry(entry)) {
    return false;
  }

  // This could be called on a new entry that does not have an id, so only
  // check id validity when the property exists
  if ('id' in entry) {
    if (!is_valid_entry_id(entry.id)) {
      console.warn('Invalid id', entry.id);
      return false;
    }
  }

  return true;
}
