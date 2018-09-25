import assert from '/src/assert/assert.js';

// TODO: decouple assert? it is not providing much value
// TODO: inline append_url_common (remnant of deprecated model.js)
// TODO: should types be a single module common to all of the db modules,
// because the entire point is to distinguish from other object types? and the
// magic stuff should be moved into types.js

export const ENTRY_MAGIC = 0xdeadbeef;

export const ENTRY_STATE_UNREAD = 0;
export const ENTRY_STATE_READ = 1;
export const ENTRY_STATE_UNARCHIVED = 0;
export const ENTRY_STATE_ARCHIVED = 1;

export function create_entry() {
  return {magic: ENTRY_MAGIC};
}

export function is_entry(value) {
  return value && typeof value === 'object' && value.magic === ENTRY_MAGIC;
}

export function is_valid_entry_id(value) {
  return Number.isInteger(value) && value > 0;
}

export function append_entry_url(entry, url) {
  assert(is_entry(entry));
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
