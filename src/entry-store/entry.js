export const ENTRY_MAGIC = 0xdeadbeef;
export const ENTRY_STATE_UNREAD = 0;
export const ENTRY_STATE_READ = 1;
export const ENTRY_STATE_UNARCHIVED = 0;
export const ENTRY_STATE_ARCHIVED = 1;

export function create_entry() {
  // Entry objects cannot be function objects, so use the magic property to
  // fake a degree of type safety
  return {magic: ENTRY_MAGIC};
}

// Return true if the first parameter looks like an entry object
export function is_entry(value) {
  // Function objects are not allowed, hence the pedantic tests and the duck
  // typing
  // NOTE: typeof null === 'object', hence the preceding truthy test
  // NOTE: uses extended check in order to exclude function objects
  return value && typeof value === 'object' && value.magic === ENTRY_MAGIC;
}

// Return true if the first parameter looks like an entry id
export function is_valid_entry_id(value) {
  return Number.isInteger(value) && value > 0;
}

export function append_entry_url(entry, url) {
  if (!is_entry(entry)) {
    throw new TypeError('Invalid entry parameter ' + entry);
  }

  // Prefer duck typing over instanceof, assume string
  if (!url.href) {
    throw new TypeError('Invalid url parameter ' + url);
  }

  const normal_url_string = url.href;
  if (entry.urls) {
    if (entry.urls.includes(normal_url_string)) {
      return false;
    }

    entry.urls.push(normal_url_string);
  } else {
    entry.urls = [normal_url_string];
  }

  return true;
}
