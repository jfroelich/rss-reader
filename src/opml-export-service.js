// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

class OPMLExportService {
  constructor() {
    this.log = new LoggingService();
  }

  start(title, fileName) {
    const context = {
      'title': title || 'Subscriptions',
      'fileName': fileName || 'subscriptions.xml',
      'feeds': [],
      'connection': null
    };

    db.open(this.onOpenDatabase.bind(this, context));
  }

  onOpenDatabase(context, event) {
    if(event.type !== 'success') {
      this.log.error('OPMLExportService: connection error');
      return;
    }

    context.connection = event.target.result;
    db.openFeedsCursor(context.connection,
      this.onCursorAdvance.bind(this, context));
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

    this.log.debug('Completed exporting %s feeds to opml file %s',
      context.feeds.length, context.fileName);
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

    return doc;
  }

  appendFeed(document, feed) {
    let outlineElement = document.createElement('outline');
    outlineElement.setAttribute('type', feed.type || 'rss');
    outlineElement.setAttribute('xmlUrl', feed.url);
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

    let bodyElement = document.body;
    if(!bodyElement) {
      bodyElement = document.createElement('body');
      document.documentElement.appendChild(bodyElement);
    }
    bodyElement.appendChild(outlineElement);
  }
}
