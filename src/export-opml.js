// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

function exportOPML(title, fileName) {
  const context = {
    'title': title || 'Subscriptions',
    'fileName': fileName || 'subscriptions.xml',
    'feeds': [],
    'connection': null
  };

  openIndexedDB(exportOPMLOnOpenDatabase.bind(null, context));
}

function exportOPMLOnOpenDatabase(context, connection) {
  if(connection) {
    context.connection = connection;
    const transaction = connection.transaction('feed');
    const store = transaction.objectStore('feed');
    const request = store.openCursor();
    request.onsuccess = exportOPMLOpenCursorOnSuccess.bind(request, context);
    request.onerror = exportOPMLOpenCursorOnError.bind(request, context);
  } else {
    console.error('Error connecting to database during opml export');
  }
}

function exportOPMLOpenCursorOnError(context, event) {
  console.error('Error opening feed cursor during opml export');
  if(context.connection) {
    context.connection.close();
  }
}

function exportOPMLOpenCursorOnSuccess(context, event) {
  const cursor = event.target.result;
  if(cursor) {
    context.feeds.push(cursor.value);
    cursor.continue();
  } else {
    context.connection.close();
    exportOPMLOnGetAllFeeds(context);
  }
}

function exportOPMLOnGetAllFeeds(context) {
  const doc = exportOPMLCreateDocument(context.title);

  for(let feed of context.feeds) {
    exportOPMLAppendFeed(doc, feed);
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
}

function exportOPMLCreateDocument(title) {
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

function exportOPMLAppendFeed(document, feed) {
  let outline = document.createElement('outline');
  outline.setAttribute('type', feed.type || 'rss');

  // Only store the terminal url
  if(feed.urls && feed.urls.length) {
    outline.setAttribute('xmlUrl', Feed.prototype.getURL.call(feed));
  } else {
    console.error('No urls found for feed', JSON.stringify(feed));
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
    bodyElement.appendChild(`outline`);
  } else {
    console.warn('Append failed, no body element found');
  }
}
