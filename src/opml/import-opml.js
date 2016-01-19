// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// Requires: /html/replace-html.js
// Requires: /lang/filter-control-characters.js
// Requires: /opml/parse-opml.js
// Requires: /storage/open-indexeddb.js
// Requires: /storage/feed-store.js

// TODO: update options.js to use this new syntax, include this file
// in options.html, the callback was changed, and for now, it is caller's
// responsibiltiy to send a notification (that functionality was lost)
// TODO: maybe change this to have an onAllFilesImported function that
// itself is responsible for doing the final callback, and also include
// the showNotification functionality there
// TODO: modify FeedStore.put, place it in its own file, then update this
// TODO: this is all new code, needs testing
// TODO: I am concerned about the separation of concerns here, in that I am
// not sure how 'aware' an import-opml process should be of a files array
// and all that. I feel like instead, it should be a function devoted to
// importing a single opml file. This shifts the responsibility to the caller
// to deal with the files array? So I would need to write some helper for
// options.js that does all of that. Then this would just be a lib.
// Also, this function would expect an open indexedDB connection, so that this
// function is not concerned with opening a new connection
// I think it is fine that this accepts a File as input, as opposed to an
// already parsed document, or the unparsed text of a file, because a file
// is a suitable type of token to pass around, and reading the file
// corresponds with the idea of importing that file.
// So what I am really trying to do is clearly define a standalone lib, and
// then hook that lib up into my app, as if I was using a 3rd party library,
// or as if there was a built in function that did this for me already that I
// was simply calling. I think it also makes the function as a whole more
// testable in isolation. So right now this is all just an effort in getting
// the rough idea to congeal into an actionable implementation. Another related
// note is that the logic of tracking progress of importing all the files
// should not be a concern within the import-opml-file lib, it should just
// call a callback when it is done. The caller can design the callback to
// do the checks for whether all files were imported.
// TODO: so to implement the above, I need to create two files. One is
// import-opml-file, that does above, and one is the helper that belongs in
// /ui/ that deals with a collection of files, and with tracking progress,
// and is called by options.js
// NOTE: I have a reservation about using a File object as the input, because
// I am not sure how 'mockable' a File object is. I mean, is it abstract? Can
// I 'create' a file object myself? I need to review this before proceeding?
// According to the Mozilla docs, File is an interface that extends Blob,
// and blobs are creatable, and filereader accepts a blob or a file, so using
// a file is fine.

'use strict';

{ // BEGIN FILE SCOPE

// Imports an array of files representing OPML documents. Calls callback when
// complete. Import errors are non-terminating

// TODO: open the connection once for all files, instead of per file, and
// change importOPMLFile to expect an open connection
// TODO: instead of an explicit tracker variable, use the this context?

function importOPML(files, callback) {

  // For shared state across async function calls
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


  // TODO: notice the subtle crossover in name, from outlines to feeds,
  // I am not sure I like it, perhaps I should use outline consistently
  // up until the point of storing the outline as a feed

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

// TODO: validate that the url value looks like a url
function isValidOutlineElement(outlineElement) {
  const TYPE_PATTERN = /rss|rdf|feed/i;
  const type = outlineElement.getAttribute('type');
  const url = outlineElement.getAttribute('xmlUrl') || '';
  return TYPE_PATTERN.test(type) && url.trim();
}

// Creates an outline object from an outline element
// TODO: create a helper function for getting a sanitized attribute value
// which will help this code be more idiomatic, concise, and less DRY
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

  // Handle a failure to open indexedDB
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

// FeedStore.put requires a defined callback
// TODO: modify FeedStore.put so that it checks for an undefined callback
// and avoids calling it, thereby allowing the caller to use null/undefined
// or not specify the last argument, then deprecate this here
function NOOP() {
}

} // END FILE SCOPE
