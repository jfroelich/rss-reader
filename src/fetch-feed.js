// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// Fetches the XML of a feed and parses it into a feed object
function fetchFeed(requestURL, timeoutMillis, excludeEntries, callback) {

  // TODO: rewrite the feed url before the request. if rewrite yields a
  // new url, store both values in the urls property of the feed that is
  // returned. To do this, I think I need to define the feed here, beforehand,
  // instead of only in the onResponse helper function.

  let requestURLString = null;

  if(Object.prototype.toString.call(requestURL) === '[object URL]') {
    requestURLString = requestURL.href;
  } else {
    requestURLString = url;
  }

  const request = new XMLHttpRequest();
  request.timeout = timeoutMillis;
  request.onerror = onResponse;
  request.ontimeout = onResponse;
  request.onabort = onResponse;
  request.onload = onResponse;
  const isAsyncRequest = true;
  request.open('GET', requestURLString, isAsyncRequest);
  request.responseType = 'document';
  request.send();

  function onResponse(event) {

    const responseURLString = event.target.responseURL || requestURL.href;
    let responseURL = null;
    try {
      responseURL = new URL(responseURLString);
    } catch(exception) {
      console.debug(exception);
    }

    // NOTE: I now set URL objects instead of strings
    // NOTE: I no longer set the request url
    const responseEvent = Object.create(null);
    responseEvent.type = event.type;

    // TODO: I am not sure I need to set this any longer, since I think i
    // will be handling the redirect here
    responseEvent.responseURL = responseURL;

    if(event.type !== 'load') {

      // TEMP
      console.debug('Unsuccessful fetch: %o', event);

      callback(responseEvent);
      return;
    }

    // Document may be undefined when trying to fetch something that is not
    // document, such as PDF file.
    const document = event.target.responseXML;
    if(!document) {
      responseEvent.type = 'invaliddocument';
      callback(responseEvent);
      return;
    }

    // Parse the XMLDocument into a basic feed object
    // TODO: look into what exceptions are thrown by feedparser. Is it
    // an Error object or a string or a mix of things?
    // TODO: responseURL may be different than requested url, I observed this
    // through logging, this should be handled here or by the caller somehow

    try {
      responseEvent.feed = FeedParser.parse(document, excludeEntries);
    } catch(exception) {
      console.debug('Feed parsing exception:', exception);
      responseEvent.type = 'parseexception';
      responseEvent.details = exception;
      callback(responseEvent);
      return;
    }

    if(responseEvent.feed) {

      // Define the request url property
      // NOTE: this is now a URL object
      // NOTE: this now uses the responseURL instead of the requestURL, because
      // that is the url that should be used to fetch the feed in the
      // future
      // NOTE: because this is now a URL object, accessing feed.url.href
      // returns the 'normalized' url, so I do not need to explicitly normalize
      // here

      // TODO: actually I don't even think I need this property anymore?

      responseEvent.feed.url = responseURL;

      // Ensure that both the requestURL and the responseURLs are in the
      // URLs array. The array is of strings.
      // This is not defined when parsing the feed because the feed parser does
      // not know the url. So this is the first chance to define it.
      // However, it is different for entries. For entries we are just dealing
      // with the link at first, so it should be defined upfront.
      const normalizedURLStringsArray = [];
      const normalizedRequestURLString = requestURL.href;
      normalizedURLStringsArray.push(normalizedRequestURLString);
      const normalizedResponseURLString = responseURL.href;
      // Only put the response url in the array if its different
      if(normalizedRequestURLString !== normalizedResponseURLString) {
        normalizedURLStringsArray.push(normalizedResponseURLString);
      }

      responseEvent.feed.urls = normalizedURLStringsArray;

      // Temp, testing
      console.debug('fetchFeed resultURLS:', responseEvent.feed.urls);

      // Define the fetch date property
      responseEvent.feed.dateFetched = new Date();

      // Define the last modified date property if available
      const lastModifiedString = event.target.getResponseHeader(
        'Last-Modified');
      if(lastModifiedString) {
        try {
          responseEvent.feed.dateLastModified = new Date(lastModifiedString);
        } catch(exception) {}
      }
    }

    callback(responseEvent);
  }
}
