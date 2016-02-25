// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// Requires: /src/feed-parser.js
// Requires: /src/utils.js

var net = {};

net.fetchFeed = function(url, timeout, callback) {
  'use strict';
  net.fetchXML(url, timeout, net.onFetchFeed.bind(null, url, callback));
};

net.onFetchFeed = function(url, callback, errorEvent, document, responseURL) {
  'use strict';

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

  callback(null, feed, responseURL);
};

net.fetchHTML = function(url, timeout, callback) {
  'use strict';
  const request = new XMLHttpRequest();
  request.timeout = timeout;

  const onError = function(event) {
    callback(event, null, request.responseURL);
  };

  request.ontimeout = onError;
  request.onerror = onError;
  request.onabort = onError;
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

net.MIME_TYPE_XML = 'application/xml';

net.fetchXML = function(url, timeout, callback) {
  'use strict';
  const request = new XMLHttpRequest();
  request.timeout = timeout;
  request.onerror = callback;
  request.ontimeout = callback;
  request.onabort = callback;
  request.onload = net.onFetchXML.bind(request, url, callback);
  request.open('GET', url, true);
  request.overrideMimeType(net.MIME_TYPE_XML);
  request.send();
};

net.onFetchXML = function(url, callback, event) {
  'use strict';
  const request = event.target;
  const responseURL = request.responseURL;
  let document = request.responseXML;

  if(!document) {
    try {
      const encoded = utf8.encode(request.responseText);
      const parser = new DOMParser();
      const reparsedDocument = parser.parseFromString(encoded, MIME_TYPE_XML);
      const error = reparsedDocument.querySelector('parsererror');
      if(error) {
        error.remove();
      }

      document = reparsedDocument;
    } catch(exception) {
      console.debug('fetchXML exception %o', exception);
    }
  }

  if(!document || !document.documentElement) {
    callback(event, null, responseURL);
    return;
  }

  callback(null, document, responseURL);
};
