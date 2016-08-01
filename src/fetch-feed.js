// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

function fetchFeed(requestURL, timeoutMillis, excludeEntries, callback) {
  console.assert(requestURL, 'requestURL is required');
  console.assert('href' in requestURL, 'requestURL must be URL like');
  console.assert(typeof timeoutMillis === 'undefined' ||
    (!isNaN(timeoutMillis) && timeoutMillis >= 0), 'Invalid timeout specified',
    timeoutMillis);

  console.debug('GET', requestURL.href);

  const isAsync = true;
  const request = new XMLHttpRequest();
  if(timeoutMillis) {
    request.timeout = timeoutMillis;
  }

  const boundOnResponse = fetchFeedOnResponse.bind(request, requestURL,
    excludeEntries, callback);

  request.onerror = boundOnResponse;
  request.ontimeout = boundOnResponse;
  request.onabort = boundOnResponse;
  request.onload = boundOnResponse;
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

  // Parse the XML file into a feed-like object
  try {
    outputEvent.feed = FeedParser.parse(document, excludeEntries);
  } catch(exception) {
    console.warn('Parsing error', requestURL.href, exception.message);
    outputEvent.type = 'ParseError';
    if(exception.message) {
      outputEvent.message = exception.message;
    }

    callback(outputEvent);
    return;
  }

  // Define the urls property. The parser does not define it for us because the
  // parser is not aware of the feed's url.
  outputEvent.feed.urls = [requestURL];

  // Check for a redirect, and if found, append it to the urls property.
  if(outputEvent.responseURL.href !== requestURL.href) {
    console.debug('Detected redirect', requestURL.href,
      outputEvent.responseURL.href);
    outputEvent.feed.urls.push(responseURL);
  }

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
