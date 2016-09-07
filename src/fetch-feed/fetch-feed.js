// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

{ // Begin file block scope

// Fetches the feed at the given url and calls back with an event object
// with props feed and entries.
// @param request_url {URL} the url of the feed to fetch
// @param exclude_entries {boolean} whether to parse entry data
// @param callback {function} called when fetch completes
this.fetch_feed = function(request_url, exclude_entries, callback) {

  // The parse_feed dependency only appears in a try/catch, so I am explicitly
  // asserting it, because otherwise the result looks like a parse exception
  // and not a static error. I do not assert it until within this function,
  // as a global assert could be evaluated before the parse-feed.js is loaded
  console.assert(parse_feed);

  console.assert(is_url_object(request_url));

  fetch_xml(request_url, function(event) {
    if(event.type !== 'success') {
      callback({'type': event.type});
      return;
    }

    let parse_result = null;
    try {
      parse_result = parse_feed(event.document, exclude_entries);
    } catch(error) {
      console.warn(error);
      callback({'type': 'feed_parse_error'});
      return;
    }

    const feed = parse_result.feed;
    const entries = parse_result.entries;

    append_feed_url(feed, request_url.href);

    // Possibly add the response url if a redirect occurred, the url is defined,
    // and it differs
    if(event.response_url_string) {
      append_feed_url(feed, event.response_url_string);
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
};

function is_url_object(value) {
  return Object.prototype.toString.call(value) === '[object URL]';
}

} // End file block scope
