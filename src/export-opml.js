// See license.md

'use strict';

{

function exportOPML(db, title, fileName, verbose, callback) {
  const log = new LoggingService();
  log.enabled = verbose;
  log.log('Exporting opml file...');
  const ctx = {
    'callback': callback,
    'title': title || 'Subscriptions',
    'fileName': fileName || 'subs.xml',
    'log': log
  };
  db.open(openDBOnSuccess.bind(ctx), openDBOnError.bind(ctx));
}

function openDBOnSuccess(event) {
  this.log.debug('Connected to database');
  const conn = event.target.result;
  const verbose = false;
  getAllFeeds(conn, verbose, onGetFeeds.bind(this));
  conn.close();
}

function openDBOnError(event) {
  this.log.error(event.target.error);
  onComplete.call(this);
}

function onGetFeeds(feeds) {
  this.log.debug('Loaded %s feeds from database', feeds.length);
  const doc = createDoc(this.title);
  const outlines = [];
  for(let feed of feeds) {
    const outline = createOutline(doc, feed);
    outlines.push(outline);
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
  this.log.debug('Triggering download of opml file');
  anchor.click();
  URL.revokeObjectURL(objectURL);
  anchor.remove();
  onComplete.call(this);
}

function onComplete() {
  this.log.log('Completed export');
  if(this.callback) {
    this.callback();
  }
}

// Creates an outline element from an object representing a feed
function createOutline(doc, feed) {
  const outline = doc.createElement('outline');

  if(feed.type) {
    outline.setAttribute('type', feed.type);
  }

  const feedURL = Feed.getURL(feed);

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
}

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
}

this.exportOPML = exportOPML;

}
