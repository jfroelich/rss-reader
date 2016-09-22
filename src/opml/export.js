// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

var rdr = rdr || {};
rdr.opml = rdr.opml || {};
rdr.opml.export = {};

// Queries the database for feeds, creates an OPML xml file, and then triggers
// the download of the file.
// @param title {String} title tag value
// @param fileName {String} name of generated file
// TODO: maybe add a verbose flag
rdr.opml.export.start = function exportFile(title, fileName) {
  const context = {
    'title': title || 'Subscriptions',
    'fileName': fileName || 'subscriptions.xml',
    'feeds': [],
    'db': null
  };

  rdr.db.open(rdr.opml.export.onOpenDB.bind(context));
};

rdr.opml.export.onOpenDB = function(db) {

  if(!db) {
    rdr.opml.export.onComplete.call(this);
    return;
  }

  // TODO: there should be a call instead to something like
  // rdr.feed.getAll(callback with array).

  this.db = db;
  const tx = db.transaction('feed');
  const store = tx.objectStore('feed');
  const request = store.openCursor();
  request.onsuccess = rdr.opml.export.openCursorOnSuccess.bind(this);
  request.onerror = rdr.opml.export.openCursorOnError.bind(this);
};

rdr.opml.export.openCursorOnError = function(event) {
  console.error(event.target.error);
  rdr.opml.export.onComplete.call(this);
};

rdr.opml.export.openCursorOnSuccess = function(event) {
  const cursor = event.target.result;
  if(cursor) {
    const feed = cursor.value;
    this.feeds.push(feed);
    cursor.continue();
  } else {
    rdr.opml.export.onGetFeeds.call(this);
  }
};

rdr.opml.export.onGetFeeds = function() {
  const doc = rdr.opml.export.createDoc(this.title);

  const outlines = [];
  for(let feed of this.feeds) {
    outlines.push(rdr.opml.export.createOutline(doc, feed));
  }

  // Append the outlines to the body
  // doc.body is sometimes undefined, but querySelector is not
  const body = doc.querySelector('body');
  for(let outline of outlines) {
    body.appendChild(outline);
  }

  // Create a blob anchor
  const writer = new XMLSerializer();
  const opmlString = writer.serializeToString(doc);
  const blob = new Blob([opmlString], {'type': 'application/xml'});
  const objectURL = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectURL;
  anchor.setAttribute('download', this.fileName);
  anchor.style.display = 'none';

  // Append the anchor to the document containing this script
  const parent = document.body || document.documentElement;
  parent.appendChild(anchor);

  // Trigger the download of the file
  anchor.click();

  URL.revokeObjectURL(objectURL);
  anchor.remove();
  rdr.opml.export.onComplete.call(this);
};

rdr.opml.export.onComplete = function() {
  if(this.db) {
    this.db.close();
  }
  console.log('Exported %s feeds to %s', this.feeds.length, this.fileName);
};

// Creates a Document object with the given title representing an OPML file
rdr.opml.export.createDoc = function(title) {
  const doc = document.implementation.createDocument(null, 'opml', null);
  doc.documentElement.setAttribute('version', '2.0');

  const head = doc.createElement('head');
  doc.documentElement.appendChild(head);

  if(title) {
    const titleEl = doc.createElement('title');
    titleEl.textContent = title;
    head.appendChild(titleEl);
  }

  const nowDate = new Date();
  const nowDateUTCString = nowDate.toUTCString();

  const dateCreatedEl = doc.createElement('datecreated');
  dateCreatedEl.textContent = nowDateUTCString;
  head.appendChild(dateCreatedEl);

  const dateModifiedEl = doc.createElement('datemodified');
  dateModifiedEl.textContent = nowDateUTCString;
  head.appendChild(dateModifiedEl);

  const docsEl = doc.createElement('docs');
  docsEl.textContent = 'http://dev.opml.org/spec2.html';
  head.appendChild(docsEl);

  const body = doc.createElement('body');
  doc.documentElement.appendChild(body);
  return doc;
};

// Creates an outline element from an object representing a feed
rdr.opml.export.createOutline = function(doc, feed) {
  const outline = doc.createElement('outline');

  if(feed.type) {
    outline.setAttribute('type', feed.type);
  }

  const feedURL = rdr.feed.getURL(feed);
  console.assert(feedURL);
  outline.setAttribute('xmlUrl', feedURL);

  if(feed.title) {
    outline.setAttribute('text', feed.title);
    outline.setAttribute('title', feed.title);
  }

  if(feed.description) {
    outline.setAttribute('description', feed.description);
  }

  if(feed.link) {
    outline.setAttribute('htmlUrl', feed.link);
  }

  return outline;
};
