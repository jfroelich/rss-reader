// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

const exportOPML = {};

exportOPML.start = function(title, fileName) {
  const context = {
    'title': title || 'Subscriptions',
    'fileName': fileName || 'subscriptions.xml',
    'feeds': [],
    'connection': null
  };

  openIndexedDB(exportOPML.onOpenDatabase.bind(null, context));
};

exportOPML.onOpenDatabase = function(context, connection) {
  if(connection) {
    context.connection = connection;
    const transaction = connection.transaction('feed');
    const store = transaction.objectStore('feed');
    const request = store.openCursor();
    request.onsuccess = exportOPML.openCursorOnSuccess.bind(request, context);
    request.onerror = exportOPML.openCursorOnError.bind(request, context);
  } else {
    console.error('Error connecting to database during opml export');
  }
};

exportOPML.openCursorOnError = function(context, event) {
  console.error('Error opening feed cursor during opml export');
  if(context.connection) {
    context.connection.close();
  }
};

exportOPML.openCursorOnSuccess = function(context, event) {
  const cursor = event.target.result;
  if(cursor) {
    context.feeds.push(cursor.value);
    cursor.continue();
  } else {
    context.connection.close();
    exportOPML.onGetFeeds(context);
  }
};

exportOPML.onGetFeeds = function(context) {
  const doc = exportOPML.createDocument(context.title);

  for(let feed of context.feeds) {
    exportOPML.appendFeed(doc, feed);
  }

  const writer = new XMLSerializer();
  const opmlString = writer.serializeToString(doc);
  const blob = new Blob([opmlString], {'type': 'application/xml'});
  const objectURL = URL.createObjectURL(blob);

  const anchor = document.createElement('a');
  anchor.href = objectURL;
  anchor.setAttribute('download', context.fileName);
  anchor.style.display = 'none';
  const parentElement = document.body || document.documentElement;
  parentElement.appendChild(anchor);
  anchor.click();

  URL.revokeObjectURL(objectURL);
  anchor.remove();

  console.log('Exported %s feeds to opml file %s', context.feeds.length,
    context.fileName);
};

exportOPML.createDocument = function(title) {
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
};

exportOPML.appendFeed = function(document, feed) {
  let outline = document.createElement('outline');
  outline.setAttribute('type', feed.type || 'rss');

  // Only store the terminal url
  if(Feed.prototype.hasURL.call(feed)) {
    outline.setAttribute('xmlUrl', Feed.prototype.getURL.call(feed));
  } else {
    console.error('Feed missing url', JSON.stringify(feed));
  }

  if(feed.title) {
    outline.setAttribute('text', feed.title);
    outline.setAttribute('title', feed.title || '');
  }
  if(feed.description) {
    outline.setAttribute('description', feed.description);
  }
  if(feed.link) {
    outline.setAttribute('htmlUrl', feed.link);
  }

  // Due to quirks with xml documents, document.body does not work
  const bodyElement = document.querySelector('body');
  if(bodyElement) {
    bodyElement.appendChild(outline);
  } else {
    console.warn('Append failed, no body element found');
  }
};
