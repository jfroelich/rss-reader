// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

var rdr = rdr || {};
rdr.feed = rdr.feed || {};

// Fetches the feed at the given url and calls back with an event object
// with props feed and entries.
// @param requestURL {URL} the url of the feed to fetch
// @param excludeEntries {boolean} whether to parse entry data
// @param callback {function} called when fetch completes
rdr.feed.fetch = function(requestURL, excludeEntries, callback) {
  console.assert(rdr.feed.isURLObject(requestURL));
  const fetchXML = rdr.xml.fetch;
  const onFetch = rdr.feed._onFetchXML.bind(null, requestURL, excludeEntries,
    callback);
  fetchXML(requestURL, onFetch);
};

rdr.feed._onFetchXML = function(requestURL, excludeEntries, callback, event) {
  const parseFeed = rdr.feed.parse;
  if(event.type !== 'success') {
    callback({'type': event.type});
    return;
  }

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
};

rdr.feed.isURLObject = function(value) {
  return Object.prototype.toString.call(value) === '[object URL]';
};
