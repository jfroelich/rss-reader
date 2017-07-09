// See license.md

'use strict';

const entry = {};

entry.UNREAD_STATE = 0;
entry.READ_STATE = 1;
entry.UNARCHIVED_STATE = 0;
entry.ARCHIVED_STATE = 1;

// Get the last url in an entry's internal url list
entry.getURLString = function(entryObject) {
  // Allow the natural error to happen if urls is not an array
  if(!entryObject.urls.length) {
    throw new TypeError('Entry object has no urls');
  }

  return entryObject.urls[entryObject.urls.length - 1];
};

// Append a url to the entry's internal url list. Lazily creates the list if
// need. Also normalizes the url. Returns false if the url already exists and
// was not added
entry.addURLString = function(entryObject, urlString) {
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
};

// Returns a new entry object where fields have been sanitized. Impure
// TODO: ensure dates are not in the future, and not too old? Should this be
// a separate function like validateEntry?
entry.sanitize = function(inputEntryObject) {
  const authorMaxLength = 200;
  const titleMaxLength = 1000;
  const contentMaxLength = 50000;
  const outputEntry = Object.assign({}, inputEntryObject);

  if(outputEntry.author) {
    let author = outputEntry.author;
    author = utils.filterControlCharacters(author);
    author = replaceHTML(author, '');
    author = utils.condenseWhitespace(author);
    author = truncateHTML(author, authorMaxLength);
    outputEntry.author = author;
  }

  // Condensing node whitespace is handled separately
  // TODO: filter out non-printable characters other than \r\n\t
  if(outputEntry.content) {
    let content = outputEntry.content;
    content = truncateHTML(content, contentMaxLength);
    outputEntry.content = content;
  }

  if(outputEntry.title) {
    let title = outputEntry.title;
    title = utils.filterControlCharacters(title);
    title = replaceHTML(title, '');
    title = utils.condenseWhitespace(title);
    title = truncateHTML(title, titleMaxLength);
    outputEntry.title = title;
  }

  return outputEntry;
};
