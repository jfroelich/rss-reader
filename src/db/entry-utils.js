import assert from '/src/assert.js';
import * as types from './types.js';

// TODO: decouple assert? it is not providing much value
// TODO: inline append_url_common (remnant of deprecated model.js)

export const ENTRY_STATE_UNREAD = 0;
export const ENTRY_STATE_READ = 1;
export const ENTRY_STATE_UNARCHIVED = 0;
export const ENTRY_STATE_ARCHIVED = 1;

// A sentinel value for entry ids. This shares the same type as a real entry
// id, but is outside the range.
export const INVALID_ENTRY_ID = 0;

export function create_entry_object() {
  return {magic: types.ENTRY_MAGIC};
}

export function is_valid_entry_id(value) {
  return Number.isInteger(value) && value > 0;
}

export function entry_has_url(entry) {
  assert(types.is_entry(entry));
  return Array.isArray(entry.urls) && entry.urls.length;
}

export function append_entry_url(entry, url) {
  assert(types.is_entry(entry));
  return append_url_common(entry, url);
}

function append_url_common(object, url) {
  assert(typeof url.href === 'string');

  const normal_url_string = url.href;
  if (object.urls) {
    if (object.urls.includes(normal_url_string)) {
      return false;
    }

    object.urls.push(normal_url_string);
  } else {
    object.urls = [normal_url_string];
  }

  return true;
}
