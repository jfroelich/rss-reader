// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// Requires: /src/feed-parser.js
// Requires: /src/fetch-xml.js
// Requires: /src/utils.js

'use strict';

{ // BEGIN ANONYMOUS NAMESPACE

function fetchFeed(url, timeout, callback) {
  fetchXML(url, timeout, onFetchFeed.bind(null, url, callback));
}

this.fetchFeed = fetchFeed;

function onFetchFeed(url, callback, errorEvent, document, responseURL) {
  if(errorEvent) {
    callback(errorEvent, null, responseURL);
    return;
  }

  let feed = null;
  try {
    feed = FeedParser.parseDocument(document);
  } catch(exception) {
    callback(exception, null, responseURL);
    return;
  }

  feed.url = url;
  feed.fetched = Date.now();

  feed.entries = feed.entries.filter(function(entry) {
    return entry.link;
  });

  feed.entries.forEach(function(entry) {
    entry.link = utils.rewriteURL(entry.link);
  });

  feed.entries = getUniqueEntries(feed.entries);

  callback(null, feed, responseURL);
}

// Given an array of entries, returns a new array of unique entries (compared
// by entry.link)
function getUniqueEntries(entries) {
  const expandedEntries = entries.map(function(entry) {
    return [entry.link, entry];
  });
  const distinctEntriesMap = new Map(expandedEntries);
  return Array.from(distinctEntriesMap.values());
}

} // END ANONYMOUS NAMESPACE
