// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

{ // Begin file block scope

// Queries the database for feeds, creates an OPML xml file, and then triggers
// the download of the file.
function exportOPMLFile(title, fileName) {
  const context = {
    'title': title || 'Subscriptions',
    'fileName': fileName || 'subscriptions.xml',
    'feeds': [],
    'db': null
  };

  openDB(onOpenDB.bind(context));
}

function onOpenDB(db) {
  if(db) {
    this.db = db;
    const tx = db.transaction('feed');
    const store = tx.objectStore('feed');
    const request = store.openCursor();
    request.onsuccess = openCursorOnSuccess.bind(this);
    request.onerror = openCursorOnError.bind(this);
  } else {
    onComplete.call(this);
  }
}

function openCursorOnError(event) {
  console.error(event.target.error);
  onComplete.call(this);
}

function openCursorOnSuccess(event) {
  const cursor = event.target.result;
  if(cursor) {
    const feed = cursor.value;
    this.feeds.push(feed);
    cursor.continue();
  } else {
    onGetFeeds.call(this);
  }
}

function onGetFeeds() {
  const doc = createDoc(this.title);

  const outlines = [];
  for(let feed of this.feeds) {
    outlines.push(createOutline(doc, feed));
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
  onComplete.call(this);
}

function onComplete() {
  if(this.db) {
    this.db.close();
  }
  console.log('Exported %s feeds to %s', this.feeds.length, this.fileName);
}

// Creates a Document object with the given title representing an OPML file
function createDoc(title) {
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
}

// Creates an outline element from an object representing a feed
function createOutline(doc, feed) {
  const outline = doc.createElement('outline');

  if(feed.type) {
    outline.setAttribute('type', feed.type);
  }

  const feedURL = getFeedURL(feed);
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
}

this.exportOPMLFile = exportOPMLFile;

} // End file block scope
