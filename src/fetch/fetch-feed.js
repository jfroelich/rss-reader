// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// Requires: /feed/parse-feed.js
// Requires: /fetch/fetch-xml.js

// TODO: the post-processing where i clean up entries should not be done here,
// it should be the caller's responsibility, it is not intrinsic to this
// function's purpose, improper separation of concerns
// TODO: the type of error passed back as first argument to the final callback
// should be consistent. Perhaps should mimic an event object and use that
// in all cases
// TODO: responseURL may be different than requested url, I observed this
// through logging, this should be handled here or by the caller somehow, right
// now this sets feed.url to requested url and just passes back responseURL
// as the third argument to the callback

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

  if(!isFeedDocument(document)) {
    callback('Invalid document element ' +
      document.documentElement.localName, null, responseURL);
    return;
  }

  let feed = null;
  try {
    feed = parseFeed(document);
  } catch(exception) {
    callback(exception, null, responseURL);
    return;
  }

  // Set properties
  feed.url = url;
  // TODO: rename to fetchDate or dateFetched to be clearer
  feed.fetched = Date.now();

  // Cleanup the entries. Remove entries without links, rewrite links,
  // and remove duplicate entries
  feed.entries = feed.entries.filter(entryHasLink);
  feed.entries.forEach(rewriteEntryLink);
  feed.entries = getUniqueEntries(feed.entries);

  callback(null, feed, responseURL);
}

function isFeedDocument(document) {
  const name = document.documentElement.localName;
  return name === 'rss' || name === 'feed' || name === 'rdf';
}

function entryHasLink(entry) {
  return entry.link;
}

function rewriteEntryLink(entry) {
  entry.link = utils.rewriteURL(entry.link);
}

function expandEntry(entry) {
  return [entry.link, entry];
}

// Given an array of entries, returns a new array of unique entries (compared
// by entry.link)
function getUniqueEntries(entries) {
  const expandedEntries = entries.map(expandEntry);
  const distinctEntriesMap = new Map(expandedEntries);
  return Array.from(distinctEntriesMap.values());
}

} // END ANONYMOUS NAMESPACE
