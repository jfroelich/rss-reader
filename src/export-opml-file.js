// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

{ // Begin file block scope

// Queries the database for feeds, creates an OPML xml file, and then triggers
// the download of the file.
this.export_opml_file = function(title, fileName) {
  const context = {
    'title': title || 'Subscriptions',
    'fileName': fileName || 'subscriptions.xml',
    'feeds': [],
    'connection': null
  };

  open_db(on_open_db.bind(this));
};

function on_open_db(connection) {
  if(connection) {
    this.connection = connection;
    const transaction = connection.transaction('feed');
    const store = transaction.objectStore('feed');
    const request = store.openCursor();
    request.onsuccess = open_cursor_onsuccess.bind(this);
    request.onerror = open_cursor_onerror.bind(this);
  } else {
    on_complete.call(this);
  }
}

function open_cursor_onerror(event) {
  console.error(event.target.error);
  on_complete.call(this);
}

function open_cursor_onsuccess(event) {
  const cursor = event.target.result;
  if(cursor) {

    const feed = deserialize_feed(cursor.value);
    this.feeds.push(feed);
    cursor.continue();
  } else {
    on_get_feeds.call(this);
  }
}

function on_get_feeds() {
  const doc = create_doc(this.title);

  const outlines = [];
  for(let feed of this.feeds) {
    outlines.push(create_outline(doc, feed));
  }

  // I do not know why using doc.body yields undefined
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
  // (not to be confused with the xml doc)
  const parentElement = document.body || document.documentElement;
  parentElement.appendChild(anchor);

  // Trigger the download of the file
  anchor.click();

  URL.revokeObjectURL(objectURL);
  anchor.remove();
  on_complete.call(this);
}

function on_complete() {

  if(this.connection) {
    this.connection.close();
  }

  console.log('Exported %s feeds to opml file %s', this.feeds.length,
    this.fileName);
}

// Creates a Document object with the given title representing an OPML file
function create_doc(title) {
  const doc = document.implementation.createDocument(null, 'opml', null);
  doc.documentElement.setAttribute('version', '2.0');

  const headElement = doc.createElement('head');
  doc.documentElement.appendChild(headElement);

  if(title) {
    const titleElement = doc.createElement('title');
    titleElement.textContent = title;
    headElement.appendChild(titleElement);
  }

  const nowDate = new Date();
  const nowUTCString = nowDate.toUTCString();

  const dateCreatedElement = doc.createElement('datecreated');
  dateCreatedElement.textContent = nowUTCString;
  headElement.appendChild(dateCreatedElement);

  const dateModifiedElement = doc.createElement('datemodified');
  dateModifiedElement.textContent = nowUTCString;
  headElement.appendChild(dateModifiedElement);

  const docsElement = doc.createElement('docs');
  docsElement.textContent = 'http://dev.opml.org/spec2.html';
  headElement.appendChild(docsElement);

  const bodyElement = doc.createElement('body');
  doc.documentElement.appendChild(bodyElement);

  return doc;
}

// Creates an outline element from a Feed object
function create_outline(document, feed) {
  const outline = document.createElement('outline');

  if(feed.type) {
    outline.setAttribute('type', feed.type);
  }

  outline.setAttribute('xmlUrl', feed.get_url().toString());

  if(feed.title) {
    outline.setAttribute('text', feed.title);
    outline.setAttribute('title', feed.title);
  }

  if(feed.description) {
    outline.setAttribute('description', feed.description);
  }

  if(feed.link) {
    outline.setAttribute('htmlUrl', feed.link.toString());
  }

  return outline;
}

} // End file block scope
