// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

{ // Begin file block scope

const EntryFlags = {
  'UNREAD': 0,
  'READ': 1,
  'UNARCHIVED': 0,
  'ARCHIVED': 1
};

// Given an entry object, return the last url in its internal url chain.
function getEntryURL(entry) {
  console.assert(entry);
  console.assert(entry.urls);
  console.assert(entry.urls.length);
  return entry.urls[entry.urls.length - 1];
}

// Returns true if the url was added.
function appendEntryURL(entry, urlString) {
  if(!entry.urls) {
    entry.urls = [];
  }

  const normalizedURLString = normalizeEntryURLString(urlString);
  if(entry.urls.includes(normalizedURLString)) {
    return false;
  }

  entry.urls.push(normalizedURLString);
  return true;
}

// Convert the url to a normal form.
function normalizeEntryURLString(urlString) {
  // Assume this never throws
  const urlObject = new URL(urlString);
  urlObject.hash = '';
  return urlObject.href;
}

// TODO: if this is reused, maybe elevate to a utility
function condenseWhitespace(inputString) {
  return inputString.replace(/\s{2,}/g, ' ');
}

// Returns a new entry object where fields have been sanitized
// TODO: ensure dates are not in the future, and not too old?
function sanitizeEntry(inputEntry) {
  const authorMaxLength = 200;
  const titleMaxLength = 1000;
  const contentMaxLength = 50000;

  const outputEntry = Object.assign({}, inputEntry);

  if(outputEntry.author) {
    let author = outputEntry.author;
    author = filterControlCharacters(author);
    author = replaceHTML(author, '');
    author = condenseWhitespace(author);
    author = truncateHTML(author, authorMaxLength);
    outputEntry.author = author;
  }

  // There is no condensing of content whitepsace here. That is done elsewhere
  // prior to calling sanitizeEntry. Because of whitespace sensitive nodes
  // TODO: filter out non-printable characters other than \r\n\t
  if(outputEntry.content) {
    let content = outputEntry.content;
    content = truncateHTML(content, contentMaxLength);
    outputEntry.content = content;
  }

  if(outputEntry.title) {
    let title = outputEntry.title;
    title = filterControlCharacters(title);
    title = replaceHTML(title, '');
    title = condenseWhitespace(title);
    title = truncateHTML(title, titleMaxLength);
    outputEntry.title = title;
  }

  return outputEntry;
}

// Add the entry to the database.
function addEntry(db, entry, callback) {
  const entryURLString = getEntryURL(entry);
  console.assert(entryURLString);
  console.debug('Adding entry', entryURLString);

  const sanitizedEntry = sanitizeEntry(entry);
  const storableEntry = filterUndefProps(sanitizedEntry);

  // Set fields that only happen on creation
  storableEntry.readState = EntryFlags.UNREAD;
  storableEntry.archiveState = EntryFlags.UNARCHIVED;
  storableEntry.dateCreated = new Date();

  // Trap a possible exception with creating the transaction
  let tx = null;
  try {
    tx = db.transaction('entry', 'readwrite');
  } catch(error) {
    console.error(entryURLString, error);
    callback({'type': 'TransactionError', 'error': error});
    return;
  }

  const store = tx.objectStore('entry');
  const request = store.add(storableEntry);
  request.onsuccess = callback;
  request.onerror = addEntryOnError.bind(request, storableEntry, callback);
}

function addEntryOnError(entry, callback, event) {
  console.error(event.target.error, getEntryURL(entry));
  callback(event);
}

this.EntryFlags = EntryFlags;
this.getEntryURL = getEntryURL;
this.appendEntryURL = appendEntryURL;
this.normalizeEntryURLString = normalizeEntryURLString;
this.addEntry = addEntry;

} // End file block scope
