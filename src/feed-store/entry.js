import assert from "/src/common/assert.js";

export const ENTRY_MAGIC = 0xdeadbeef;
export const STATE_UNREAD = 0;
export const STATE_READ = 1;
export const STATE_UNARCHIVED = 0;
export const STATE_ARCHIVED = 1;

export function createEntry() {
  const entry = {};
  entry.magic = ENTRY_MAGIC;
  return entry;
}

// Return true if the first parameter is an entry object
export function isEntry(value) {
  // the null check is done to avoid error that occurs due to typeof null being object
  return value !== null && typeof value === 'object' && value.magic === ENTRY_MAGIC;
}

// Returns true if the id is a valid entry id, structurally. This does not check if the id actually
// corresponds to an entry.
export const isValidId = function(id) {
  // TODO: is 0 actually valid? what is first value of indexedDB auto-increment?
  return Number.isInteger(id) && id >= 0;
};

// Returns true if the entry has at least one url
export function hasURL(entry) {
  assert(isEntry(entry));
  return entry.urls && (entry.urls.length > 0);
}

// Returns the last url, as a string, in the entry's url list. This should never be called on an
// entry without urls.
export function peekURL(entry) {
  assert(isEntry(entry));
  assert(hasURL(entry));
  return entry.urls[entry.urls.length - 1];
}

// TODO: change to accept a URL as input instead of a string

// Append a url to an entry's url list. Lazily creates the urls property if needed. Normalizes the
// url. The normalized url is compared against existing urls to ensure the new url is unique.
// @returns {Boolean} true if entry was added, or false if the url already exists and was therefore
// not added
export function appendURL(entry, urlString) {
  assert(isEntry(entry));

  assert(typeof urlString === 'string' && urlString.length > 0);

  // This throws a TypeError if url is invalid or relative
  const urlObject = new URL(urlString);
  const normalUrlString = urlObject.href;
  if(entry.urls) {
    if(entry.urls.includes(normalUrlString)) {
      return false;
    }

    entry.urls.push(normalUrlString);
  } else {
    entry.urls = [normalUrlString];
  }

  return true;
}
