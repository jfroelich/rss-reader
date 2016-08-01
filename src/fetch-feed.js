// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

function fetchFeed(requestURL, timeoutMillis, excludeEntries, callback) {
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

  if(event.type !== 'load') {
    console.debug(event.type, event.target.status, requestURL.href);
    callback({'type': event.type});
    return;
  }

  outputEvent.responseURL = new URL(event.target.responseURL);
  outputEvent.responseXML = event.target.responseXML;

  const document = event.target.responseXML;
  if(!document) {
    outputEvent.type = 'UndefinedDocumentError';
    callback(outputEvent);
    return;
  }

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

  outputEvent.feed.urls = [requestURL];
  if(outputEvent.responseURL.href !== requestURL.href) {
    console.debug('Detected redirect', requestURL.href,
      outputEvent.responseURL.href);
    outputEvent.feed.urls.push(responseURL);
  }

  outputEvent.feed.dateFetched = new Date();

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
