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
  const outputEvent = {
    'type': event.type
  };

  // Check that we got a load response
  if(event.type !== 'load') {
    console.debug(event.type, event.target.status, requestURL.href);
    callback({'type': event.type});
    return;
  }

  outputEvent.responseURL = new URL(event.target.responseURL);
  outputEvent.responseXML = event.target.responseXML;

  // Check that the document is defined. The document may be undefined when
  // we fetched a file with a mime-type not compatable with the responseType
  // setting of XMLHttpRequest
  const document = event.target.responseXML;
  if(!document) {
    outputEvent.type = 'UndefinedDocumentError';
    callback(outputEvent);
    return;
  }

  // TODO: parseFeed should yield a Feed object

  // Parse the XML file into a feed-like object
  try {
    outputEvent.feed = FeedParser.parseDocument(document, excludeEntries);
  } catch(exception) {
    console.warn('Parsing error', requestURL.href, exception.message);
    outputEvent.type = 'ParseError';
    if(exception.message) {
      outputEvent.message = exception.message;
    }

    callback(outputEvent);
    return;
  }

  // Set the url. The parser does not define it for us because the
  // parser is not aware of the feed's url. addURL will lazily create the
  // appropriate property.
  Feed.prototype.addURL.call(outputEvent.feed, requestURL);

  // Set the redirect (addURL implicitly handles uniqueness)
  Feed.prototype.addURL.call(outputEvent.feed, outputEvent.responseURL);

  // Introduce a date fetched property
  outputEvent.feed.dateFetched = new Date();

  // Introduce a dateLastModified property based on the file's date which is
  // from the response header.
  const lastModifiedString = event.target.getResponseHeader(
    'Last-Modified');
  if(lastModifiedString) {
    try {
      outputEvent.feed.dateLastModified = new Date(lastModifiedString);
    } catch(parseError) {
      console.warn('Error parsing last modified header', parseError);
    }
  }

  callback(outputEvent);
}
