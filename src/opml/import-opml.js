// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// Requires: /html/replace-html.js
// Requires: /lang/filter-control-characters.js
// Requires: /opml/parse-opml.js
// Requires: /storage/open-indexeddb.js
// Requires: /storage/feed-store.js

'use strict';

{ // BEGIN FILE SCOPE

// Imports an array of files representing OPML documents. Calls callback when
// complete. Import errors are non-terminating
function importOPML(files, callback) {

  const tracker = {
    errors: [],
    numFiles: files.length,
    filesImported: 0
  };

  Array.prototype.forEach.call(files,
    importOPMLFile.bind(null, tracker, callback));
}

this.importOPML = importOPML;

// Import an opml file. Call the callback if it is the last file imported.
function importOPMLFile(tracker, callback, file) {
  const reader = new FileReader();
  const onload = onFileLoad.bind(reader, tracker, callback);
  reader.onload = onload;
  reader.onerror = onload;
  reader.readAsText(file);
}

function onFileLoad(tracker, callback, event) {

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
    document = parseOPML(text);
  } catch(exception) {

    tracker.errors.push(exception);
    if(tracker.filesImported === tracker.numFiles) {
      callback(tracker);
    }
    return;
  }

  const feeds = getOutlines(document);

  // Remove feeds with equivalent urls
  const expandedFeeds = feeds.map(expandFeed);
  const urlFeedMap = new Map(expandedFeeds);

  // Do an early exit in order to try and avoid connecting to indexedDB
  // if there is nothing to do
  if(!urlFeedMap.size) {
    if(tracker.filesImported === tracker.numFiles) {
      callback(tracker);
    }
    return;
  }

  openIndexedDB(storeFeeds.bind(null, tracker, callback, urlFeedMap));
}

function expandFeed(feed) {
  return [feed.url, feed];
}

function getOutlines(document) {
  const outlines = document.querySelectorAll('opml > body > outline');
  const validOutlines = Array.prototype.filter.call(outlines,
    isValidOutlineElement);
  return validOutlines.map(createOutlineFromElement);
}

function isValidOutlineElement(outlineElement) {
  const TYPE_PATTERN = /rss|rdf|feed/i;
  const type = outlineElement.getAttribute('type');
  const url = outlineElement.getAttribute('xmlUrl') || '';
  return TYPE_PATTERN.test(type) && url.trim();
}

// Creates an outline object from an outline element
function createOutlineFromElement(element) {
  const outline = {};

  let title = element.getAttribute('title') || '';
  title = title.trim();
  if(!title) {
    title = element.getAttribute('text') || '';
    title = title.trim();
  }
  title = filterControlCharacters(title);
  if(title) {
    outline.title = title;
  }

  let description = element.getAttribute('description');
  if(description) {
    description = filterControlCharacters(description);
  }
  if(description) {
    description = replaceHTML(description);
  }
  if(description) {
    description = description.trim();
  }
  if(description) {
    outline.description = description;
  }

  let url = element.getAttribute('xmlUrl') || '';
  url = filterControlCharacters(url);
  url = url.trim();
  if(url) {
    outline.url = url;
  }

  let link = element.getAttribute('htmlUrl') || '';
  link = filterControlCharacters(link);
  link = link.trim();
  if(link) {
    outline.link = link;
  }
  return outline;
}

function storeFeeds(tracker, callback, urlFeedMap, event) {

  if(event.type !== 'success') {
    tracker.errors.push(event);
    if(tracker.filesImported === tracker.numFiles) {
      callback(tracker);
    }
    return;
  }

  const connection = event.target.result;

  // Fire off async requests, we do not wait for them to complete
  for(let feed of urlFeedMap.values()) {
    FeedStore.put(connection, null, feed, NOOP);
  }

  if(tracker.filesImported === tracker.numFiles) {
    callback(tracker);
  }
}

function NOOP() {}

} // END FILE SCOPE
