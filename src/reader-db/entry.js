import assert from "/src/assert.js";
import isPosInt from "/src/utils/is-pos-int.js";
import {isCanonicalURLString} from "/src/url/url-string.js";

// entry.js provides utility functions for working with model objects. Because the extension works
// with indexedDB, it can only store structured clonable objects. Function objects (e.g. new Entry)
// are not structured clonable. Marshalling objects from basic objects to function objects and back
// for all the various reading and writing is very slow. Therefore, entry objects must be plain
// old objects. Unfortunately, this leaves the app with very little type safety. To counter this
// lack of type safety, entry objects are stored and operated upon using a 'secret' property so
// that functions can assert that a given object 'is' an entry object by checking that a given
// object is both an object and has the secret property with the given 'magic' value.
//
// Note that I prefer this object to not be exported. So callers should not use it. However,
// at the moment, open.js relies on it being public, so it must be exported.
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
  return typeof value === 'object' && value !== null && value.magic === ENTRY_MAGIC;
}

// Returns true if the id is a valid entry id, structurally. This does not check if the id actually
// corresponds to an entry.
export const isValidId = isPosInt;

// Returns true if the entry has at least one url
export function hasURL(entry) {
  assert(isEntry(entry));
  return entry.urls && entry.urls.length;
}

// Returns the last url, as a string, in the entry's url list. This should never be called on an
// entry without urls.
export function peekURL(entry) {
  assert(isEntry(entry));
  assert(hasURL(entry));
  return entry.urls[entry.urls.length - 1];
}

// Append a url to an entry's url list. Lazily creates the urls property if needed. Normalizes the
// url. The normalized url is compared against existing urls to ensure the new url is unique.
// @returns {Boolean} true if entry was added, or false if the url already exists and was therefore
// not added
export function appendURL(entry, urlString) {
  assert(isEntry(entry));
  assert(isCanonicalURLString(urlString));

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
