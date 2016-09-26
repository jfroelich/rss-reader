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
rdr.feed.fetch = function(requestURL, excludeEntries, callback, verbose) {
  if(!rdr.utils.isURLObject(requestURL)) {
    throw new TypeError('requestURL must be a URL');
  }

  // We don't want to mistake this error with a non-fatal parse error later
  if(!rdr.feed.parse) {
    throw new ReferenceError('Missing dependency rdr.feed.parse');
  }

  const ctx = {
    'requestURL': requestURL,
    'excludeEntries': excludeEntries,
    'callback': callback,
    'verbose': verbose
  };

  rdr.xml.fetch(requestURL, rdr.feed._onFetchXML.bind(ctx), verbose);
};

rdr.feed._onFetchXML = function(event) {

  if(event.type !== 'success') {
    this.callback({'type': event.type});
    return;
  }

  let parseResult = null;
  try {
    parseResult = rdr.feed.parse(event.document, this.excludeEntries);
  } catch(error) {
    if(this.verbose) {
      console.warn(error);
    }

    this.callback({'type': 'ParseError'});
    return;
  }

  const feed = parseResult.feed;
  const entries = parseResult.entries;

  // Set the request and response urls
  rdr.feed.addURL(feed, this.requestURL.href);
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
  this.callback(successEvent);
};
