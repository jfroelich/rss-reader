// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

{ // Begin file block scope

const flags = {
  'UNREAD': 0,
  'READ': 1,
  'UNARCHIVED': 0,
  'ARCHIVED': 1
};

// Given an entry object, return the last url in its internal url chain.
function getURL(entry) {
  console.assert(entry);
  console.assert(entry.urls);
  console.assert(entry.urls.length);
  return entry.urls[entry.urls.length - 1];
}

// Returns true if the url was added.
function addURL(entry, urlString) {
  if(!entry.urls) {
    entry.urls = [];
  }

  const normalizedURLString = rdr.entry.normalizeURL(urlString);
  if(entry.urls.includes(normalizedURLString)) {
    return false;
  }

  entry.urls.push(normalizedURLString);
  return true;
}

// Convert the url to a normal form.
function normalizeURL(urlString) {
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
    author = rdr.filterControlChars(author);
    author = rdr.html.replaceTags(author, '');
    author = condenseWhitespace(author);
    author = rdr.html.truncate(author, authorMaxLength);
    outputEntry.author = author;
  }

  // There is no condensing of content whitepsace here. That is done elsewhere
  // prior to calling sanitizeEntry. Because of whitespace sensitive nodes
  // TODO: filter out non-printable characters other than \r\n\t
  if(outputEntry.content) {
    let content = outputEntry.content;
    content = rdr.html.truncate(content, contentMaxLength);
    outputEntry.content = content;
  }

  if(outputEntry.title) {
    let title = outputEntry.title;
    title = rdr.filterControlChars(title);
    title = rdr.html.replaceTags(title, '');
    title = condenseWhitespace(title);
    title = rdr.html.truncate(title, titleMaxLength);
    outputEntry.title = title;
  }

  return outputEntry;
}

// Add the entry to the database.
function addEntry(db, entry, callback) {
  const entryURLString = rdr.entry.getURL(entry);
  console.assert(entryURLString);
  console.debug('Adding entry', entryURLString);

  const sanitizedEntry = sanitizeEntry(entry);
  const storableEntry = rdr.filterUndefProps(sanitizedEntry);

  // Set fields that only happen on creation
  storableEntry.readState = rdr.entry.flags.UNREAD;
  storableEntry.archiveState = rdr.entry.flags.UNARCHIVED;
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
  console.error(event.target.error, rdr.entry.getURL(entry));
  callback(event);
}

var rdr = rdr || {};
rdr.entry = rdr.entry || {};
rdr.entry.flags = flags;
rdr.entry.getURL = getURL;
rdr.entry.addURL = addURL;
rdr.entry.normalizeURL = normalizeURL;
rdr.entry.add = addEntry;

rdr.entry.filterTitle = function(title) {
  console.assert(title);

  let index = title.lastIndexOf(' - ');
  if(index === -1)
    index = title.lastIndexOf(' | ');
  if(index === -1)
    index = title.lastIndexOf(' : ');
  if(index === -1)
    return title;

  const trailingText = title.substring(index + 1);

  const tokens = trailingText.split(/\s+/g);

  // Split can yield empty strings, filter them
  const definedTokens = tokens.filter(function(token) {
    return token;
  });

  if(definedTokens.length < 5) {
    const new_title = title.substring(0, index).trim();
    return new_title;
  }

  return title;
};

} // End file block scope
