// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// Requires: /src/utils.js
// Requires: /src/db.js

var opml = {};

opml.createOPMLDocument = function(title, feeds) {
  'use strict';
  const doc = document.implementation.createDocument(null, 'opml', null);
  const documentElement = doc.documentElement;
  documentElement.setAttribute('version', '2.0');

  const headElement = doc.createElement('head');
  documentElement.appendChild(headElement);
  const titleElement = doc.createElement('title');
  titleElement.textContent = title || '';
  headElement.appendChild(titleElement);
  const nowDate = new Date();
  const nowUTCString = nowDate.toUTCString();
  const dateCreatedElement = doc.createElement('dateCreated');
  dateCreatedElement.textContent = nowUTCString;
  headElement.appendChild(dateCreatedElement);
  const dateModifiedElement = doc.createElement('dateModified');
  dateModifiedElement.textContent = nowUTCString;
  headElement.appendChild(dateModifiedElement);
  const docsElement = doc.createElement('docs');
  docsElement.textContent = 'http://dev.opml.org/spec2.html';
  headElement.appendChild(docsElement);
  const bodyElement = doc.createElement('body');
  documentElement.appendChild(bodyElement);

  let outlineElement;
  for(let feed of feeds) {
    outlineElement = doc.createElement('outline');
    outlineElement.setAttribute('type', feed.type || 'rss');
    outlineElement.setAttribute('xmlUrl', feed.url);
    outlineElement.setAttribute('text', feed.title || '');
    outlineElement.setAttribute('title', feed.title || '');
    outlineElement.setAttribute('description', feed.description || '');
    outlineElement.setAttribute('htmlUrl', feed.link || '');
    bodyElement.appendChild(outlineElement);
  }

  return doc;
};

// Imports an array of files representing OPML documents. Calls callback when
// complete.
opml.importOPML = function(files, callback) {
  'use strict';
  const tracker = {
    errors: [],
    numFiles: files.length,
    filesImported: 0
  };

  // TODO: rather than pass around the callback, have each early exit
  // call onImportComplete, which then checks tracker if all files imported
  // and calls callback. Then bind callback once to onImportComplete
  // and pass that around.

  Array.prototype.forEach.call(files,
    opml.importOPMLFile.bind(null, tracker, callback));
};

opml.importOPMLFile = function(tracker, callback, file) {
  'use strict';
  const reader = new FileReader();
  const onload = opml.onFileLoad.bind(reader, tracker, callback);
  reader.onload = onload;
  reader.onerror = onload;
  reader.readAsText(file);
};

opml.onFileLoad = function(tracker, callback, event) {
  'use strict';
  tracker.filesImported++;

  if(event.type === 'error') {
    tracker.errors.push(event);
    if(tracker.filesImported === tracker.numFiles) {
      callback(tracker);
    }
    return;
  }

  const reader = event.target;
  const text = reader.result;
  let document = null;
  try {
    document = opml.parseOPML(text);
  } catch(exception) {

    tracker.errors.push(exception);
    if(tracker.filesImported === tracker.numFiles) {
      callback(tracker);
    }
    return;
  }

  let feeds = opml.parseFeeds(document);
  feeds = opml.getDistinctFeedsByURL(feeds);

  if(!feeds.length) {
    if(tracker.filesImported === tracker.numFiles) {
      callback(tracker);
    }
    return;
  }

  db.open(opml.storeFeeds.bind(null, tracker, callback, feeds));
};

opml.getDistinctFeedsByURL = function(feeds) {
  'use strict';
  const pairs = feeds.map(function expand(feed) {
    return [feed.url, feed];
  });
  const map = new Map(pairs);
  return map.values();
};

opml.isValidOutlineElement = function(element) {
  'use strict';
  const TYPE_PATTERN = /rss|rdf|feed/i;
  const type = element.getAttribute('type');
  const url = element.getAttribute('xmlUrl') || '';
  return TYPE_PATTERN.test(type) && url.trim();
};

opml.parseFeed = function(element) {
  'use strict';
  const feed = {};
  let title = element.getAttribute('title') ||
    element.getAttribute('text') || '';
  feed.title = utils.filterControlCharacters(title).trim();
  let description = element.getAttribute('description') || '';
  description = utils.filterControlCharacters(description);
  description = utils.replaceHTML(description);
  feed.description = description.trim();
  let url = element.getAttribute('xmlUrl') || '';
  feed.url = utils.filterControlCharacters(url).trim();
  let link = element.getAttribute('htmlUrl') || '';
  feed.link = utils.filterControlCharacters(link).trim();
  return feed;
};

opml.parseFeeds = function(document) {
  'use strict';

  const root = document.documentElement;
  if(!root) return [];
  let body = null;
  for(let element = root.firstElementChild; element && !body;
    element = node.nextElementSibling) {
    if(element.localName === 'body') {
      body = element;
    }
  }
  if(!body) return [];
  const feeds = [];
  for(let element = body.firstElementChild; element;
    element = node.nextElementSibling) {
    if(element.localName === 'outline' &&
      opml.isValidOutlineElement(element)) {
      feeds.push(opml.parseFeed(element));
    }
  }
  return feeds;
};

opml.parseOPML = function(string) {
  'use strict';
  const document = opml.parseXML(string);
  if(!document.documentElement.matches('opml')) {
    throw new Error('Invalid document element: ' +
      document.documentElement.localName);
  }
  return document;
};

opml.parseXML = function(string) {
  'use strict';

  const parser = new DOMParser();
  const MIME_TYPE_XML = 'application/xml';
  const document = parser.parseFromString(string, MIME_TYPE_XML);

  if(!document) {
    throw new Error('Undefined document');
  }

  if(!document.documentElement) {
    throw new Error('Undefined document element');
  }

  // TODO: strip html from the error message?
  const parserError = document.querySelector('parsererror');
  if(parserError) {
    throw new Error(parserError.textContent);
  }

  return document;
};

// TODO: accept feeds array, not map
opml.storeFeeds = function(tracker, callback, feeds, event) {
  'use strict';

  if(event.type !== 'success') {
    tracker.errors.push(event);
    if(tracker.filesImported === tracker.numFiles) {
      callback(tracker);
    }
    return;
  }

  const connection = event.target.result;
  for(let feed of feeds) {
    db.storeFeed(connection, null, feed, opml.NOOP);
  }

  if(tracker.filesImported === tracker.numFiles) {
    callback(tracker);
  }
};

opml.NOOP = function() {};
