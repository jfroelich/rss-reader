// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

var rdr = rdr || {};
rdr.entry = rdr.entry || {};
rdr.entry.flags = {
  'UNREAD': 0,
  'READ': 1,
  'UNARCHIVED': 0,
  'ARCHIVED': 1
};

// Given an entry object, return the last url in its internal url chain.
rdr.entry.getURL = function(entry) {

  if(!entry.urls.length) {
    throw new Error('entry missing url');
  }

  return entry.urls[entry.urls.length - 1];
};

// Returns true if the url was added.
rdr.entry.addURL = function(entry, urlString) {
  if(!entry.urls) {
    entry.urls = [];
  }

  const normalizedURLString = rdr.entry.normalizeURL(urlString);
  if(entry.urls.includes(normalizedURLString)) {
    return false;
  }

  entry.urls.push(normalizedURLString);
  return true;
};

rdr.entry.normalizeURL = function(urlString) {
  const urlObject = new URL(urlString);
  urlObject.hash = '';
  return urlObject.href;
};

rdr.entry.add = function(db, entry, callback) {
  if(!rdr.entry.getURL(entry)) {
    throw new Error('tried to add entry without a url');
  }

  const sanitizedEntry = rdr.entry._sanitize(entry);
  const storableEntry = rdr.utils.filterEmptyProps(sanitizedEntry);

  storableEntry.readState = rdr.entry.flags.UNREAD;
  storableEntry.archiveState = rdr.entry.flags.UNARCHIVED;
  storableEntry.dateCreated = new Date();
  const tx = db.transaction('entry', 'readwrite');
  const store = tx.objectStore('entry');
  const request = store.add(storableEntry);
  request.onsuccess = callback;
  request.onerror = rdr.entry._addOnError.bind(null, storableEntry, callback);
};

rdr.entry._addOnError = function(entry, callback, event) {
  console.error(event.target.error, rdr.entry.getURL(entry));
  callback(event);
};

// Returns a new entry object where fields have been sanitized
// TODO: ensure dates are not in the future, and not too old?
rdr.entry._sanitize = function(inputEntry) {
  const authorMaxLength = 200;
  const titleMaxLength = 1000;
  const contentMaxLength = 50000;

  const outputEntry = Object.assign({}, inputEntry);

  if(outputEntry.author) {
    let author = outputEntry.author;
    author = rdr.utils.filterControlChars(author);
    author = rdr.html.replaceTags(author, '');
    author = rdr.utils.condenseSpaces(author);
    author = rdr.html.truncate(author, authorMaxLength);
    outputEntry.author = author;
  }

  // There is no condensing of content whitepsace here. That is done elsewhere
  // prior to calling rdr.entry._sanitize. Because of whitespace sensitive nodes
  // TODO: filter out non-printable characters other than \r\n\t
  if(outputEntry.content) {
    let content = outputEntry.content;
    content = rdr.html.truncate(content, contentMaxLength);
    outputEntry.content = content;
  }

  if(outputEntry.title) {
    let title = outputEntry.title;
    title = rdr.utils.filterControlChars(title);
    title = rdr.html.replaceTags(title, '');
    title = rdr.utils.condenseSpaces(title);
    title = rdr.html.truncate(title, titleMaxLength);
    outputEntry.title = title;
  }

  return outputEntry;
};

rdr.entry.filterTitle = function(title) {
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
    const newTitle = title.substring(0, index).trim();
    return newTitle;
  }

  return title;
};
