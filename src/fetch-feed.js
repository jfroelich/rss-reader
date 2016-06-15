// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// Fetches the XML of a feed and parses it into a feed object
// TODO: maybe require a URL object as a parameter instead of a string
function fetchFeed(urlString, timeoutMillis, excludeEntries, callback) {
  const request = new XMLHttpRequest();
  request.timeout = timeoutMillis;
  request.onerror = onError;
  request.ontimeout = onError;
  request.onabort = onError;
  request.onload = onLoad;
  const isAsyncRequest = true;
  request.open('GET', urlString, isAsyncRequest);
  request.responseType = 'document';
  request.send();

  function onLoad(event) {
    const fetchEvent = {
      'type': event.type,
      'requestURLString': urlString,
      'responseURLString': event.target.responseURL
    };

    // Document may be undefined when trying to fetch something that is not
    // document, such as PDF file.
    // TODO: would documentElement ever actually be undefined?
    // If an error occurs, wouldn't that mean that onLoad doesn't even
    // get called? I need to look into this more.
    const document = event.target.responseXML;
    if(!document || !document.documentElement) {
      fetchEvent.type = 'invaliddocument';
      callback(fetchEvent);
      return;
    }

    // Parse the XMLDocument into a basic feed object
    // TODO: look into what exceptions are thrown by feedparser. Is it
    // an Error object or a string or a mix of things?
    // TODO: responseURL may be different than requested url, I observed this
    // through logging, this should be handled here or by the caller somehow

    try {
      fetchEvent.feed = FeedParser.parse(document, excludeEntries);
    } catch(exception) {
      fetchEvent.type = 'parseexception';
      fetchEvent.details = exception;
    }

    if(fetchEvent.feed) {
      // Define the request url property
      fetchEvent.feed.url = urlString;

      // Define the fetch date property
      fetchEvent.feed.dateFetched = new Date();

      // Define the last modified date property if available
      const lastModifiedString = event.target.getResponseHeader(
        'Last-Modified');
      if(lastModifiedString) {
        try {
          fetchEvent.feed.dateLastModified = new Date(lastModifiedString);
        } catch(exception) {}
      }
    }

    callback(fetchEvent);
  }

  function onError(event) {
    const fetchEvent = {
      'type': event.type,
      'requestURLString': urlString,
      'responseURLString': event.target.responseURL
    };
    callback(fetchEvent);
  }
}
