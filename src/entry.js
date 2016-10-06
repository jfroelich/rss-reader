// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';


const Entry = {};

Entry.flags = {
  'UNREAD': 0,
  'READ': 1,
  'UNARCHIVED': 0,
  'ARCHIVED': 1
};

// Given an entry object, return the last url in its internal url chain.
Entry.getURL = function(entry) {

  if(!entry.urls.length) {
    throw new Error('entry missing url');
  }

  return entry.urls[entry.urls.length - 1];
};

// Returns true if the url was added.
Entry.addURL = function(entry, urlString) {
  if(!entry.urls) {
    entry.urls = [];
  }

  const normalizedURLString = Entry.normalizeURL(urlString);
  if(entry.urls.includes(normalizedURLString)) {
    return false;
  }

  entry.urls.push(normalizedURLString);
  return true;
};

Entry.normalizeURL = function(urlString) {
  const urlObject = new URL(urlString);
  urlObject.hash = '';
  return urlObject.href;
};


// Returns a new entry object where fields have been sanitized
// TODO: ensure dates are not in the future, and not too old?
Entry.sanitize = function(inputEntry) {
  const authorMaxLength = 200;
  const titleMaxLength = 1000;
  const contentMaxLength = 50000;

  const outputEntry = Object.assign({}, inputEntry);

  if(outputEntry.author) {
    let author = outputEntry.author;
    author = ReaderUtils.filterControlChars(author);
    author = rdr.html.replaceTags(author, '');
    author = ReaderUtils.condenseWhitespace(author);
    author = rdr.html.truncate(author, authorMaxLength);
    outputEntry.author = author;
  }

  // There is no condensing of content whitepsace here. That is done elsewhere
  // prior to calling Entry.sanitize. Because of whitespace sensitive nodes
  // TODO: filter out non-printable characters other than \r\n\t
  if(outputEntry.content) {
    let content = outputEntry.content;
    content = rdr.html.truncate(content, contentMaxLength);
    outputEntry.content = content;
  }

  if(outputEntry.title) {
    let title = outputEntry.title;
    title = ReaderUtils.filterControlChars(title);
    title = rdr.html.replaceTags(title, '');
    title = ReaderUtils.condenseWhitespace(title);
    title = rdr.html.truncate(title, titleMaxLength);
    outputEntry.title = title;
  }

  return outputEntry;
};

Entry.filterTitle = function(title) {
  let index = title.lastIndexOf(' - ');
  if(index === -1)
    index = title.lastIndexOf(' | ');
  if(index === -1)
    index = title.lastIndexOf(' : ');
  if(index === -1)
    return title;

  // todo: should this be +3 given the spaces wrapping the delim?
  const tail = title.substring(index + 1);
  const nTerms = tail.split(/\s+/g).filter((w) => w).length;
  return nTerms < 5 ? title.substring(0, index).trim() : title;
};
