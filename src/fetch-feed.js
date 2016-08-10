// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

function fetchFeed(requestURL, timeoutMillis, excludeEntries, callback) {
  console.assert(requestURL, 'requestURL is required');
  console.assert(Object.prototype.toString.call(requestURL) === '[object URL]',
    'requestURL must be URL', requestURL, typeof requestURL,
    Object.prototype.toString.call(requestURL));
  console.assert(typeof timeoutMillis === 'undefined' ||
    (!isNaN(timeoutMillis) && timeoutMillis >= 0), 'Invalid timeout specified',
    timeoutMillis);

  console.debug('GET', requestURL.href);

  const request = new XMLHttpRequest();
  if(timeoutMillis) {
    request.timeout = timeoutMillis;
  }

  const onResponse = fetchFeedOnResponse.bind(request, requestURL,
    excludeEntries, callback);
  request.onerror = onResponse;
  request.ontimeout = onResponse;
  request.onabort = onResponse;
  request.onload = onResponse;

  const isAsync = true;
  request.open('GET', requestURL.href, isAsync);
  request.responseType = 'document';
  request.send();
}

function fetchFeedOnResponse(requestURL, excludeEntries, callback, event) {
  // Check that we got a load response
  if(event.type !== 'load') {
    console.debug(event.type, requestURL.href);
    callback({'type': event.type, 'requestURL': requestURL});
    return;
  }

  // Check that the document is defined. The document may be undefined when
  // we fetched a file with a mime-type not compatable with the responseType
  // setting of XMLHttpRequest
  const document = event.target.responseXML;
  if(!document) {
    callback({
      'type': 'UndefinedDocumentError',
      'requestURL': requestURL
    });
    return;
  }

  // Parse the XML file into a Feed object
  let feed = null;
  try {
    feed = FeedParser.parseDocument(document, excludeEntries);
  } catch(exception) {
    console.warn(exception.message);
    callback({
      'type': 'ParseError',
      'message': exception.message,
      'requestURL': requestURL
    });
    return;
  }

  // NOTE: addURL expects a URL object, not a string
  feed.addURL(requestURL);
  feed.addURL(new URL(event.target.responseURL));
  feed.dateFetched = new Date();

  const lastModified = event.target.getResponseHeader('Last-Modified');
  if(lastModified) {
    try {
      feed.dateLastModified = new Date(lastModified);
    } catch(parseError) {
      console.warn(parseError);
    }
  }

  callback({
    'type': 'load',
    'feed': feed,
    'requestURL': requestURL
  });
}
