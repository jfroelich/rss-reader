// feed entry object utilities

import assert from "/src/assert.js";
import {replaceTags, truncate as htmlTruncate} from "/src/html.js";
import {isPosInt} from "/src/number.js";
import {filterControls, condenseWhitespace} from "/src/string.js";
import {isCanonicalURL} from "/src/url.js";


export const ENTRY_STATE_UNREAD = 0;
export const ENTRY_STATE_READ = 1;
export const ENTRY_STATE_UNARCHIVED = 0;
export const ENTRY_STATE_ARCHIVED = 1;

// Return true if the first parameter is an entry object
export function entryIsEntry(entry) {
  return typeof entry === 'object';
}

// Returns true if the id is a valid entry id, structurally. This does not
// check if the id actually corresponds to an entry.
export function entryIsValidId(id) {
  return isPosInt(id);
}

export function entryHasURL(entry) {
  assert(entryIsEntry(entry));
  return entry.urls && entry.urls.length;
}

// Returns the most last url, as a string, in the entry's url list. Throws an
// error if the entry does not have urls.
// @throws AssertionError
export function entryPeekURL(entry) {
  assert(entryIsEntry(entry));
  assert(entryHasURL(entry));
  return entry.urls[entry.urls.length - 1];
}

// Append a url to an entry's url list. Lazily creates the list if needed.
// Normalizes the url. Returns true if the url was added. Returns false if the
// normalized url already exists and therefore was not added
// @throws {Error} if urlString is invalid
export function entryAppendURL(entry, urlString) {
  assert(entryIsEntry(entry));
  assert(isCanonicalURL(urlString));

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

// Returns a new entry object where fields have been sanitized. Impure
export function entrySanitize(inputEntry, authorMaxLength, titleMaxLength, contextMaxLength) {
  assert(entryIsEntry(inputEntry));

  if(typeof authorMaxLength === 'undefined') {
    authorMaxLength = 200;
  }

  if(typeof titleMaxLength === 'undefined') {
    titleMaxLength = 1000;
  }

  if(typeof contextMaxLength === 'undefined') {
    contextMaxLength = 50000;
  }

  assert(isPosInt(authorMaxLength));
  assert(isPosInt(titleMaxLength));
  assert(isPosInt(contextMaxLength));

  const outputEntry = Object.assign({}, inputEntry);

  if(outputEntry.author) {
    let author = outputEntry.author;
    author = filterControls(author);
    author = replaceTags(author, '');
    author = condenseWhitespace(author);
    author = htmlTruncate(author, authorMaxLength);
    outputEntry.author = author;
  }

  if(outputEntry.content) {
    let content = outputEntry.content;
    content = htmlTruncate(content, contextMaxLength);
    outputEntry.content = content;
  }

  if(outputEntry.title) {
    let title = outputEntry.title;
    title = filterControls(title);
    title = replaceTags(title, '');
    title = condenseWhitespace(title);
    title = htmlTruncate(title, titleMaxLength);
    outputEntry.title = title;
  }

  return outputEntry;
}
