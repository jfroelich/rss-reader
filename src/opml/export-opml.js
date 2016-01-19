// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// Requires: /storage/get-all-feeds.js
// Requires: /storage/open-indexeddb.js

// TODO: update dependencies
// TODO: delete opml-utils.js
// TODO: deprecate opml-document.js

// TODO: the database connection setup is probably the responsibility
// of the caller, not here, this should just accept a feeds array?

'use strict';

{ // BEGIN FILE SCOPE

// Generates an OPMLDocument representing all feeds in the database
// and passes it to the callback as the second argument. If an error
// occurs, the first argument is set and represents the error object.
function exportOPML(title, callback) {
  const document = createOPMLDocument(title);
  openIndexedDB(onOpenIndexedDB.bind(null, document, callback));
}

this.exportOPML = exportOPML;

function onOpenIndexedDB(document, callback, event) {
  if(event.type === 'success') {
    const connection = event.target.result;
    getAllFeeds(connection, appendFeeds.bind(null, document, callback));
  } else {
    // Connection failure
    callback(event, document);
  }
}

function appendFeeds(document, callback, feeds) {
  //const feeds = event.target.result;



  for(let feed of feeds) {
    appendFeedToDocument(document, feed);
  }

  callback(null, document);
}

// Creates an outline element and appends it to the document
function appendFeedToDocument(document, feed) {

  const outlineElement = document.createElement('outline');

  outlineElement.setAttribute('type', feed.type || 'rss');
  outlineElement.setAttribute('xmlUrl', feed.url);
  if(feed.title) {
    outlineElement.setAttribute('text', feed.title);
    outlineElement.setAttribute('title', feed.title);
  }
  if(feed.description) {
    outlineElement.setAttribute('description', feed.description);
  }

  if(feed.link) {
    outlineElement.setAttribute('htmlUrl', feed.link);
  }

  let bodyElement = document.querySelector('opml > body');
  if(!bodyElement) {
    bodyElement = document.createElement('body');
    let documentElement = document.querySelector('opml');
    if(!documentElement) {
      documentElement = document.createElement('opml');
      document.appendChild(documentElement);
    }
    documentElement.appendChild(bodyElement);
  }

  bodyElement.appendChild(outlineElement);
}



function createOPMLDocument(title) {

  const doc = document.implementation.createDocument(null, null);
  const documentElement = doc.createElement('opml');
  documentElement.setAttribute('version', '2.0');

  const headElement = doc.createElement('head');
  documentElement.appendChild(headElement);

  const titleElement = doc.createElement('title');
  titleElement.textContent = title;
  headElement.appendChild(titleElement);

  const nowDate = new Date();
  const UTCNowString = nowDate.toUTCString();
  const dateCreatedElement = doc.createElement('dateCreated');
  dateCreatedElement.textContent = UTCNowString;
  headElement.appendChild(dateCreatedElement);

  const dateModifiedElement = doc.createElement('dateModified');
  dateModifiedElement.textContent = UTCNowString;
  headElement.appendChild(dateModifiedElement);

  const docsElement = doc.createElement('docs');
  docsElement.textContent = 'http://dev.opml.org/spec2.html';
  headElement.appendChild(docsElement);

  const bodyElement = doc.createElement('body');
  documentElement.appendChild(bodyElement);

  return doc;
}

// TODO: these two functions probably belong in a separate file
// or require some more thought. i am not sure they even belong here,
// perhaps they are helper functions of the caller code, generating
// a blob really has nothing to do with generating an opml document
// also, these two functions could be merged into one
function serializeOPMLDocument(document) {
  const writer = new XMLSerializer();
  const string = writer.serializeToString(document);
  return string;
}

function createOPMLBlob(document) {
  const string = serializeOPMLDocument(document);
  const blobFormat = {type: 'application/xml'};
  const blob = new Blob([string], blobFormat);
  return blob;
}

this.createOPMLBlob = createOPMLBlob;

} // END FILE SCOPE
