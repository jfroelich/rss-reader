// See license.md

/*
TODO:
- maybe entry should have just single state like UNREAD_UNARCHIVED,
READ_ARCHIVED, etc
- issue with normalizing entry urs. https://hack.ether.camp/idea/path
redirects to https://hack.ether.camp/#/idea/path which normalizes to
https://hack.ether.camp/. Stripping hash screws this up.
- for urls with path containing '//', replace with '/'

TODO: maybe use a single property with 4 values instead of two separate
properties for read state and archive state. This will speed up archive and
similar queries

*/

'use strict';

const Entry = {};
Entry.UNREAD = 0;
Entry.READ = 1;
Entry.UNARCHIVED = 0;
Entry.ARCHIVED = 1;

// Given an entry object, return the last url in its internal url chain.
Entry.getURL = function(entry) {

  if(!entry.urls.length) {
    throw new Error('Entry missing url');
  }

  return entry.urls[entry.urls.length - 1];
};

// TODO: allow for initial url to be added without full normalization so that
// normalized url is just later in the chain?

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

// TODO: maybe fix urls like this, look for pathname starting with '//'?
// http://us.battle.net//hearthstone/en/blog/20303037

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
    author = filterControlChars(author);
    author = replaceTags(author, '');
    author = condenseWhitespace(author);
    author = truncateHTML(author, authorMaxLength);
    outputEntry.author = author;
  }

  // There is no condensing of content whitepsace here. That is done elsewhere
  // prior to calling Entry.sanitize. Because of whitespace sensitive nodes
  // TODO: filter out non-printable characters other than \r\n\t
  if(outputEntry.content) {
    let content = outputEntry.content;
    content = truncateHTML(content, contentMaxLength);
    outputEntry.content = content;
  }

  if(outputEntry.title) {
    let title = outputEntry.title;
    title = filterControlChars(title);
    title = replaceTags(title, '');
    title = condenseWhitespace(title);
    title = truncateHTML(title, titleMaxLength);
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
