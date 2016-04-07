// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// Requires: /src/feed-parser.js

function net_fetch_feed(url, timeout, callback) {
  'use strict';

  const request = new XMLHttpRequest();
  request.timeout = timeout;
  request.onerror = function on_error(event) {
    callback(event, null, request.responseURL);
  };

  request.ontimeout = function on_timeout(event) {
    callback(event, null, request.responseURL);
  };

  request.onabort = function on_abort(event) {
    callback(event, null, request.responseURL);
  };

  request.onload = function on_load(event) {
    const document = request.responseXML;

    if(!document) {
      callback(event, document, request.responseURL);
      return;
    }

    if(!document.documentElement) {
      callback(event, document, request.responseURL);
      return;
    }

    const parserError = document.querySelector('parsererror');
    if(parserError) {
      console.debug(parserError.outerHTML);
      parserError.remove();
    }

    let feed = null;
    try {
      feed = feed_parser_parse_document(document);
    } catch(exception) {
      callback(exception, null, request.responseURL);
      return;
    }

    feed.url = url;

    // TODO: look into the consistency of storing dates for other fields. I
    // think all fields should use the same convention. And I think that a
    // date should be a date. This might require several other changes.
    feed.fetchDate = new Date();

    // TODO: this post-processing may be outside the scope of this
    // functions responsibility

    // Filter empty links
    feed.entries = feed.entries.filter(function get_entry_link(entry) {
      return entry.link;
    });

    // Rewrite links
    feed.entries.forEach(function rewrite_entry_link(entry) {
      entry.link = rewrite_url(entry.link);
    });

    // Remove duplicate entries by link
    const expandedEntries = feed.entries.map(function expand_entry(entry) {
      return [entry.link, entry];
    });
    const distinctEntriesMap = new Map(expandedEntries);
    feed.entries = Array.from(distinctEntriesMap.values());

    callback(null, feed, request.responseURL);
  };
  request.open('GET', url, true);
  request.responseType = 'document';
  request.send();
}

function net_fetch_html(url, timeout, callback) {
  'use strict';

  const request = new XMLHttpRequest();
  request.timeout = timeout;
  request.ontimeout = function on_timeout(event) {
    callback(event, null, request.responseURL);
  };
  request.onerror = function on_error(event) {
    callback(event, null, request.responseURL);
  };
  request.onabort = function on_abort(event) {
    callback(event, null, request.responseURL);
  };
  request.onload = function on_load(event) {
    let error = null;
    const document = request.responseXML;
    if(!document) {
      error = new Error('Undefined document for url ' + url);
    } else if(!document.documentElement) {
      error = new Error('Undefined document element for url ' + url);
    }
    callback(error, document, request.responseURL);
  };
  request.open('GET', url, true);
  request.responseType = 'document';
  request.send();
}
