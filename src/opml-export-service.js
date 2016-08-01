// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// TODO: revert to using namespace object and static functions, it is just so
// much cleaner. I think I hate ES6 class syntax.

class OPMLExportService {
  constructor() {
    this.cache = new FeedCache();
  }

  start(title, fileName) {
    const context = {
      'title': title || 'Subscriptions',
      'fileName': fileName || 'subscriptions.xml',
      'feeds': [],
      'connection': null
    };

    openIndexedDB(this.onOpenDatabase.bind(this, context));
  }

  onOpenDatabase(context, connection) {
    if(connection) {
      context.connection = connection;

      const transaction = connection.transaction('feed');
      const store = transaction.objectStore('feed');
      const request = store.openCursor();
      request.onsuccess = this.onCursorAdvance.bind(this, context);
      request.onerror = this.onCursorAdvance.bind(this, context);
    }
  }

  onCursorAdvance(context, event) {
    const cursor = event.target.result;
    if(cursor) {
      context.feeds.push(cursor.value);
      cursor.continue();
    } else {
      this.onGetAllFeeds(context);
    }
  }

  onGetAllFeeds(context) {
    const opmlDoc = this.createDocument(context.title);

    for(let feed of context.feeds) {
      this.appendFeed(opmlDoc, feed);
    }

    const writer = new XMLSerializer();
    const opmlString = writer.serializeToString(opmlDoc);
    const blob = new Blob([opmlString], {'type': 'application/xml'});
    const objectURL = URL.createObjectURL(blob);

    const anchor = document.createElement('a');
    anchor.href = objectURL;
    anchor.setAttribute('download', context.fileName);
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();

    URL.revokeObjectURL(objectURL);
    anchor.remove();

    console.info('Exported %s feeds to opml file %s', context.feeds.length,
      context.fileName);
  }

  createDocument(title) {
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

  appendFeed(document, feed) {
    let outlineElement = document.createElement('outline');
    outlineElement.setAttribute('type', feed.type || 'rss');

    // Only store the terminal url
    if(feed.urls && feed.urls.length) {
      outlineElement.setAttribute('xmlUrl', Feed.prototype.getURL.call(feed));
    } else {
      console.error('No urls found for feed', JSON.stringify(feed));
    }

    if(feed.title) {
      outlineElement.setAttribute('text', feed.title);
      outlineElement.setAttribute('title', feed.title || '');
    }
    if(feed.description) {
      outlineElement.setAttribute('description', feed.description);
    }
    if(feed.link) {
      outlineElement.setAttribute('htmlUrl', feed.link);
    }

    // Due to quirks with xml documents, document.body does not work
    const bodyElement = document.querySelector('body');
    if(bodyElement) {
      bodyElement.appendChild(outlineElement);
    } else {
      console.warn('Append failed, no body element found');
    }
  }
}
