// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

{ // Begin file block scope

// Fetches the feed at the given url and calls back with an event object
// with props feed and entries.
// @param requestURL {URL} the url of the feed to fetch
// @param excludeEntries {boolean} whether to parse entry data
// @param callback {function} called when fetch completes
function fetchImpl(requestURL, excludeEntries, callback) {
  console.assert(isURLObject(requestURL));

  rdr.fetchXML(requestURL,
    onFetchXML.bind(null, requestURL, excludeEntries, callback));
}

function onFetchXML(requestURL, excludeEntries, callback, event) {
  if(event.type !== 'success') {
    callback({'type': event.type});
    return;
  }

  console.assert(event.document);
  const parseFeed = rdr.parseFeed;
  let parseResult = null;
  try {
    parseResult = parseFeed(event.document, excludeEntries);
  } catch(error) {
    console.warn(error);
    callback({'type': 'feed_parse_error'});
    return;
  }

  const feed = parseResult.feed;
  const entries = parseResult.entries;

  // Set the request and response urls
  rdr.feed.addURL(feed, requestURL.href);
  if(event.responseURLString) {
    rdr.feed.addURL(feed, event.responseURLString);
  }

  feed.dateFetched = new Date();
  feed.dateLastModified = event.lastModifiedDate;

  const successEvent = {
    'type': 'success',
    'feed': feed,
    'entries': entries
  };
  callback(successEvent);
}

function isURLObject(value) {
  return Object.prototype.toString.call(value) === '[object URL]';
}

var rdr = rdr || {};
rdr.feed = rdr.feed || {};
rdr.feed.fetch = fetchImpl;

} // End file block scope
