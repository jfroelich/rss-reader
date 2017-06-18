// See license.md

'use strict';

const ENTRY_UNREAD_STATE = 0;
const ENTRY_READ_STATE = 1;
const ENTRY_UNARCHIVED_STATE = 0;
const ENTRY_ARCHIVED_STATE = 1;

// Get the last url in an entry's internal url list
function jrGetEntryURLString(entryObject) {
  // Allow the natural error to happen if urls is not an array
  if(!entryObject.urls.length)
    throw new TypeError('Entry object has no urls');
  return entryObject.urls[entryObject.urls.length - 1];
}

// Append a url to the entry's internal url list. Lazily creates the list if
// need. Also normalizes the url. Returns false if the url already exists and
// was not added
function jrAddEntryURL(entryObject, urlString) {
  const normalizedURLObject = new URL(urlString);
  if(entryObject.urls) {
    if(entryObject.urls.includes(normalizedURLObject.href)) {
      return false;
    }
    entryObject.urls.push(normalizedURLObject.href);
  } else {
    entryObject.urls = [normalizedURLObject.href];
  }

  return true;
}

// Returns a new entry object where fields have been sanitized. Impure
// TODO: ensure dates are not in the future, and not too old? Should this be
// a separate function like validateEntry?
function jrSanitizeEntry(inputEntryObject) {
  const authorMaxLen = 200;
  const titleMaxLen = 1000;
  const contentMaxLen = 50000;
  const outputEntry = Object.assign({}, inputEntryObject);

  if(outputEntry.author) {
    let author = outputEntry.author;
    author = jrUtilsFilterControlChars(author);
    author = jrUtilsReplaceHTML(author, '');
    author = jrUtilsCondenseWhitespace(author);
    author = jrUtilsTruncateHTML(author, authorMaxLen);
    outputEntry.author = author;
  }

  // Condensing node whitespace is handled separately
  // TODO: filter out non-printable characters other than \r\n\t
  if(outputEntry.content) {
    let content = outputEntry.content;
    content = jrUtilsTruncateHTML(content, contentMaxLen);
    outputEntry.content = content;
  }

  if(outputEntry.title) {
    let title = outputEntry.title;
    title = jrUtilsFilterControlChars(title);
    title = jrUtilsReplaceHTML(title, '');
    title = jrUtilsCondenseWhitespace(title);
    title = jrUtilsTruncateHTML(title, titleMaxLen);
    outputEntry.title = title;
  }

  return outputEntry;
}
