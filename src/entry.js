'use strict';

// import base/assert.js
// import base/number.js
// import base/sizeof.js
// import base/errors.js
// import base/string.js
// import net/url-utils.js
// import html.js


const ENTRY_STATE_UNREAD = 0;
const ENTRY_STATE_READ = 1;
const ENTRY_STATE_UNARCHIVED = 0;
const ENTRY_STATE_ARCHIVED = 1;

// Return true if the first parameter is an entry object
function entryIsEntry(entry) {
  return typeof entry === 'object';
}

// Returns true if the id is a valid entry id, structurally. This does not
// check if the id actually corresponds to an entry.
function entryIsValidId(id) {
  return numberIsPositiveInteger(id);
}

function entryHasURL(entry) {
  assert(entryIsEntry(entry));
  return entry.urls && entry.urls.length;
}

// Returns the most last url, as a string, in the entry's url list. Throws an
// error if the entry does not have urls.
function entryGetTopURL(entry) {
  assert(entryIsEntry(entry));
  assert(entryHasURL(entry));
  return entry.urls[entry.urls.length - 1];
}

// Append a url to an entry's url list. Lazily creates the list if needed.
// Normalizes the url. Returns true if the url was added. Returns false if the
// normalized url already exists and therefore was not added
// @throws {Error} if urlString is invalid
function entryAppendURL(entry, urlString) {
  assert(entryIsEntry(entry));
  assert(URLUtils.isCanonical(urlString));

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
function entrySanitize(inputEntry, authorMaxLength, titleMaxLength,
  contextMaxLength) {
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

  assert(numberIsPositiveInteger(authorMaxLength));
  assert(numberIsPositiveInteger(titleMaxLength));
  assert(numberIsPositiveInteger(contextMaxLength));

  const outputEntry = Object.assign({}, inputEntry);

  if(outputEntry.author) {
    let author = outputEntry.author;
    author = stringFilterControlChars(author);
    author = htmlReplaceTags(author, '');
    author = stringCondenseWhitespace(author);
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
    title = stringFilterControlChars(title);
    title = htmlReplaceTags(title, '');
    title = stringCondenseWhitespace(title);
    title = htmlTruncate(title, titleMaxLength);
    outputEntry.title = title;
  }

  return outputEntry;
}

// Returns a new entry object that is in a compacted form. The new entry is a
// shallow copy of the input entry, where only certain properties are kept, and
// a couple properties are changed.
function entryCompact(entry) {
  const ce = {};
  ce.dateCreated = entry.dateCreated;
  ce.dateRead = entry.dateRead;
  ce.feed = entry.feed;
  ce.id = entry.id;
  ce.readState = entry.readState;
  ce.urls = entry.urls;
  ce.archiveState = ENTRY_STATE_ARCHIVED;
  ce.dateArchived = new Date();
  console.debug('before', sizeof(entry), 'after', sizeof(ce));
  return ce;
}
