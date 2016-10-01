// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

function OPMLExportService() {
  this.log = new LoggingService();
  this.dbService = new FeedDbService();

  // TODO: i would rather this be a reference to something like a
  // FeedStorageService
  this.getFeeds = rdr.feed.getAll;
  this.getFeedURL = rdr.get.getURL;
}

// Load feeds from the database and export them to an opml file
OPMLExportService.prototype.start = function(title, fileName, callback) {
  this.log.log('Starting opml export');

  const ctx = {
    'callback': callback,
    'title': title || 'Subscriptions',
    'fileName': fileName || 'subscriptions.xml'
  };
  this.dbService.open(this._openDBOnSuccess.bind(this, ctx),
    this._openDBOnError.bind(this, ctx));
};

OPMLExportService.prototype._openDBOnSuccess = function(ctx, event) {
  this.log.debug('Connected to database');
  const db = event.target.result;
  this.getFeeds(db, this._onGetFeeds.bind(this, ctx));
  // As long as we call this after initiating the tx in getFeeds, it does not
  // matter that we call this before the tx resolves, this simply queues the
  // conn to close once no txs are outstanding.
  db.close();
};

OPMLExportService.prototype._openDBOnError = function(ctx, event) {
  console.error(event.target.error);
  this._onComplete(ctx);
};

OPMLExportService.prototype._onGetFeeds = function(ctx, feeds) {
  this.log.debug('Loaded %s feeds from database', feeds.length);
  const doc = this._createDoc(ctx.title);
  const outlines = [];
  for(let feed of feeds) {
    outlines.push(this._createOutline(doc, feed));
  }

  // Append the outlines to the body
  // doc.body is sometimes undefined, not sure why
  const body = doc.querySelector('body');
  for(let outline of outlines) {
    body.appendChild(outline);
  }

  const writer = new XMLSerializer();
  const opmlString = writer.serializeToString(doc);
  const blob = new Blob([opmlString], {'type': 'application/xml'});
  const objectURL = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectURL;
  anchor.setAttribute('download', this.fileName);
  anchor.style.display = 'none';
  const parent = document.body || document.documentElement;
  parent.appendChild(anchor);
  anchor.click();
  URL.revokeObjectURL(objectURL);
  anchor.remove();
  this._onComplete(ctx);
};

OPMLExportService.prototype._onComplete = function(ctx) {
  this.log.log('Completed export');
  if(ctx.callback) {
    ctx.callback();
  }
};

// Creates an outline element from an object representing a feed
OPMLExportService.prototype._createOutline = function(doc, feed) {
  const outline = doc.createElement('outline');

  if(feed.type) {
    outline.setAttribute('type', feed.type);
  }

  const feedURL = this.getFeedURL(feed);

  // This should never happen. A feed loaded from the database should always
  // have a url. This exception is not caught in the calling context, it is
  // intended to be fatal-like.
  if(!feedURL) {
    throw new Error('missing url: ' + JSON.stringify(feed));
  }

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

OPMLExportService.prototype._createDoc = function(title) {
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
  const dateCreated = doc.createElement('datecreated');
  dateCreated.textContent = nowDateUTCString;
  head.appendChild(dateCreated);
  const dateModified = doc.createElement('datemodified');
  dateModified.textContent = nowDateUTCString;
  head.appendChild(dateModified);
  const docs = doc.createElement('docs');
  docs.textContent = 'http://dev.opml.org/spec2.html';
  head.appendChild(docs);
  const body = doc.createElement('body');
  doc.documentElement.appendChild(body);
  return doc;
};
