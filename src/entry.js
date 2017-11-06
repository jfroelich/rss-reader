'use strict';

// import net/url-utils.js
// import html.js
// import rbl.js

// TODO: entry is too generic of an term, add qualifying to name

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
  return rbl.isPosInt(id);
}

function entryHasURL(entry) {
  assert(entryIsEntry(entry));
  return entry.urls && entry.urls.length;
}

// Returns the most last url, as a string, in the entry's url list. Throws an
// error if the entry does not have urls.
// @throws AssertionError
function entryPeekURL(entry) {
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
// @throws AssertionError, ParserError
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

  assert(rbl.isPosInt(authorMaxLength));
  assert(rbl.isPosInt(titleMaxLength));
  assert(rbl.isPosInt(contextMaxLength));

  const outputEntry = Object.assign({}, inputEntry);

  if(outputEntry.author) {
    let author = outputEntry.author;
    author = rbl.filterControls(author);
    author = htmlReplaceTags(author, '');
    author = rbl.condenseWhitespace(author);
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
    title = rbl.filterControls(title);
    title = htmlReplaceTags(title, '');
    title = rbl.condenseWhitespace(title);
    title = htmlTruncate(title, titleMaxLength);
    outputEntry.title = title;
  }

  return outputEntry;
}
