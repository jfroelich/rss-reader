// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

const ENTRY_FLAGS = {
  'UNREAD': 0,
  'READ': 1,
  'UNARCHIVED': 0,
  'ARCHIVED': 1
};

// Given an entry object, return the last url in its internal url chain.
// This function assumes that entry.urls is always a defined array with at
// least one value. In general, an entry shouldn't exist without a url, or the
// caller should never be calling this function at that point. It is the
// caller's responsibility to ensure the presence of a url.
function getEntryURL(entry) {
  console.assert(entry);
  console.assert(entry.urls);
  console.assert(entry.urls.length);
  return entry.urls[entry.urls.length - 1];
}

// Note: untested, under dev. The input this time is a string, and entry.urls
// should contain strings. Part of a series of changes i am making with plan
// to avoid having to deserialize and reserialize entries
// Returns true if the url was added.
function appendEntryURL(entry, urlString) {
  console.assert(entry);
  console.assert(urlString);

  // Lazily create the urls property. This is not the caller's responsibility
  // because it means less boilerplate.
  if(!('urls' in entry)) {
    entry.urls = [];
  }

  // In order to compare the url to existing urls, we need to convert the url
  // to a URL object. This should never throw. It is the caller's responsibility
  // to provide a valid url.
  const urlObject = new URL(urlString);

  // To normalize a value means that a given value could have many valid
  // realizations, and that given any one of these realizations, to change the
  // value into a canonical, standard, preferred form. For example, the value
  // could be uppercase, or mixed case, or lowercase. The preferred form is
  // lowercase. So normalizing the value means lower casing it.

  // Apply additional url normalizations. Delete the hash
  // It's possible this should be a function call like normalize_url(url).
  // Deleting the hash is not really a normalization in the basic sense of
  // dealing with varied string representations. Here I am removing the hash
  // because I want to consider a url with a hash and without, which is
  // otherwise the same url, as the same url.
  urlObject.hash = '';

  // Now get a normalized url. The process of converting to a url object and
  // back to a string is what caused the normalization. This built in process
  // does several things, like remove default ports, lowercase hostname,
  // lowercase protocol, etc.
  const normalizedURLString = urlObject.href;

  // Check that the url does not already exist. entry.urls only contains
  // normalized url strings because only normalized urls are added
  for(let entryURLString of entry.urls) {
    if(entryURLString === normalizedURLString) {
      return false;
    }
  }

  entry.urls.push(normalizedURLString);

  // Temp, testing url rewriting new approach
  //if(entry.urls.length > 1) {
  //  console.debug('Entry urls:', entry.urls);
  //}

  return true;
}

// Returns a new entry object where fields have been sanitized. This is a
// pure function. The input entry is not modified. Object properties of the
// input are cloned so that future changes to its properties have no effect on
// the sanitized copy.
function sanitizeEntry(inputEntry) {

  const outputEntry = Object.assign({}, inputEntry);

  // Sanitize the author html string
  // TODO: enforce a maximum length using truncateHTML
  // TODO: condense spaces?
  if(outputEntry.author) {
    let author = outputEntry.author;
    author = filterControlCharacters(author);
    author = replaceHTML(author, '');
    //author = truncateHTML(author, MAX_AUTHOR_VALUE_LENGTH);
    outputEntry.author = author;
  }

  // TODO: Sanitize entry.content
  // TODO: filter out non-printable characters other than \r\n\t
  // TODO: enforce a maximum storable length (using truncateHTML)
  // TODO: condense certain spaces? have to be careful about sensitive space

  // Sanitize the title
  // TODO: enforce a maximum length using truncateHTML
  // TODO: condense spaces?
  if(outputEntry.title) {
    let title = outputEntry.title;
    title = filterControlCharacters(title);
    title = replaceHTML(title, '');
    outputEntry.title = title;
  }

  return outputEntry;
}

{ // Begin addEntry block scope

// Add the entry to the database. Sets a few fields such as dateCreated.
function addEntry(db, entry, callback) {

  const entryURLString = getEntryURL(entry);

  // The entry should be defined
  console.assert(entry);
  // The entry should have at least one url
  console.assert(entryURLString);

  console.debug('Adding entry', entryURLString);

  const sanitizedEntry = sanitizeEntry(entry);
  const storableEntry = filterUndefProps(sanitizedEntry);
  storableEntry.readState = ENTRY_FLAGS.UNREAD;
  storableEntry.archiveState = ENTRY_FLAGS.UNARCHIVED;
  storableEntry.dateCreated = new Date();

  let tx = null;
  try {
    tx = db.transaction('entry', 'readwrite');
  } catch(error) {
    console.error(entryURLString, error);
    callback({'type': 'create_tx_error', 'error': error});
    return;
  }

  const store = tx.objectStore('entry');
  const request = store.add(storableEntry);
  request.onsuccess = callback;
  request.onerror = addOnerror.bind(request, storableEntry, callback);
}

function addOnerror(entry, callback, event) {
  // TODO: this appears in the log due to polling, but it shouldn't.
  // I should have caught all attempts to insert a duplicate entry
  console.error(event.target.error, getEntryURL(entry));
  callback(event);
}

this.addEntry = addEntry;

} // End addEntry block scope
