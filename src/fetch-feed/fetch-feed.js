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
function fetchFeed(requestURL, excludeEntries, callback) {

  // The parseFeed dependency only appears in a try/catch, so I am explicitly
  // asserting it, because otherwise the result looks like a parse exception
  // and not a static error. I do not assert it until within this function,
  // as a global assert could be evaluated before the parse-feed.js is loaded
  console.assert(parseFeed);

  console.assert(isURLObject(requestURL));

  fetchXML(requestURL, function(event) {
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
    appendFeedURL(feed, requestURL.href);
    if(event.responseURLString) {
      appendFeedURL(feed, event.responseURLString);
    }

    feed.dateFetched = new Date();
    feed.dateLastModified = event.last_modified_date;

    const successEvent = {
      'type': 'success',
      'feed': feed,
      'entries': entries
    };
    callback(successEvent);
  });
}

function isURLObject(value) {
  return Object.prototype.toString.call(value) === '[object URL]';
}

this.fetchFeed = fetchFeed;

} // End file block scope
