// TODO: for model modules, these are meant to be object-like APIs, so consider
// camel case

export const MAGIC = 0xdeadbeef;

// TODO: the ENTRY_ prefix is superfluous now that this is within a model module
export const STATE_UNREAD = 0;
export const STATE_READ = 1;
export const STATE_UNARCHIVED = 0;
export const STATE_ARCHIVED = 1;

// Create an object representing an entry
export function create() {
  return {magic: MAGIC};
}

// Return true if the first parameter looks like an entry object
// Function objects are not allowed, hence the pedantic tests and the duck
// typing
// NOTE: typeof null === 'object'
export function is_entry(value) {
  return value && typeof value === 'object' && value.magic === MAGIC;
}

export function is_valid_id(value) {
  return Number.isInteger(value) && value > 0;
}

// Append a url to an entry's url list. Lazily creates the urls property if
// needed. Normalizes the url. The normalized url is compared against existing
// urls to ensure the new url is unique. Returns true if entry was added, or
// false if the url already exists and was therefore not added.
export function append_url(entry, url) {
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
