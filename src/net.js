// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// Requires: /src/feed-parser.js
// Requires: /src/utils.js

var net = {};

net.fetchFeed = function(url, timeout, callback) {
  'use strict';

  const request = new XMLHttpRequest();
  request.timeout = timeout;
  request.onerror = function(event) {
    callback(event, null, request.responseURL);
  };
  request.ontimeout = function(event) {
    callback(event, null, request.responseURL);
  };
  request.onabort = function(event) {
    callback(event, null, request.responseURL);
  };
  request.onload = function(event) {
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
      feed = parseFeed(document);
    } catch(exception) {
      callback(exception, null, request.responseURL);
      return;
    }

    feed.url = url;
    feed.fetchDate = Date.now();

    // Filter empty links
    feed.entries = feed.entries.filter(function(entry) {
      return entry.link;
    });

    // Rewrite links
    feed.entries.forEach(function(entry) {
      entry.link = utils.rewriteURL(entry.link);
    });

    // Remove duplicates
    const expandedEntries = feed.entries.map(function(entry) {
      return [entry.link, entry];
    });
    const distinctEntriesMap = new Map(expandedEntries);
    feed.entries = Array.from(distinctEntriesMap.values());
    callback(null, feed, request.responseURL);
  };
  request.open('GET', url, true);
  request.responseType = 'document';
  request.send();
};

net.fetchHTML = function(url, timeout, callback) {
  'use strict';
  const request = new XMLHttpRequest();
  request.timeout = timeout;
  request.ontimeout = function(event) {
    callback(event, null, request.responseURL);
  };
  request.onerror = function(event) {
    callback(event, null, request.responseURL);
  };
  request.onabort = function(event) {
    callback(event, null, request.responseURL);
  };
  request.onload = function(event) {
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
};
