// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

{ // Begin file block scope

// Queries the database for feeds, creates an OPML xml file, and then triggers
// the download of the file.
this.export_opml_file = function(title, file_name) {
  const context = {
    'title': title || 'Subscriptions',
    'file_name': file_name || 'subscriptions.xml',
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
  const opml_string = writer.serializeToString(doc);
  const blob = new Blob([opml_string], {'type': 'application/xml'});
  const object_url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = object_url;
  anchor.setAttribute('download', this.file_name);
  anchor.style.display = 'none';

  // Append the anchor to the document containing this script
  // (not to be confused with the xml doc)
  const parent_el = document.body || document.documentElement;
  parent_el.appendChild(anchor);

  // Trigger the download of the file
  anchor.click();

  URL.revokeObjectURL(object_url);
  anchor.remove();
  on_complete.call(this);
}

function on_complete() {

  if(this.connection) {
    this.connection.close();
  }

  console.log('Exported %s feeds to opml file %s', this.feeds.length,
    this.file_name);
}

// Creates a Document object with the given title representing an OPML file
function create_doc(title) {
  const doc = document.implementation.createDocument(null, 'opml', null);
  doc.documentElement.setAttribute('version', '2.0');

  const head = doc.createElement('head');
  doc.documentElement.appendChild(head);

  if(title) {
    const title_el = doc.createElement('title');
    title_el.textContent = title;
    head.appendChild(title_el);
  }

  const now_date = new Date();
  const now_utc = now_date.toUTCString();

  const date_created_el = doc.createElement('datecreated');
  date_created_el.textContent = now_utc;
  head.appendChild(date_created_el);

  const date_modified_el = doc.createElement('datemodified');
  date_modified_el.textContent = now_utc;
  head.appendChild(date_modified_el);

  const docs_el = doc.createElement('docs');
  docs_el.textContent = 'http://dev.opml.org/spec2.html';
  head.appendChild(docs_el);

  const body = doc.createElement('body');
  doc.documentElement.appendChild(body);
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
