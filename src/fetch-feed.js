// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// NOTE: this does not assume url is defined? It just fails in that case. The
// thing is, does it fail by calling request.onerror or does it cause a
// javascript error? If it is a js error then maybe I need to guard.
// TODO: I think this should always just pass back event and let caller test
// against it, instead the whole only-defined-event-if-error thing
// TODO: the type of error passed back as first argument to the final callback
// should be consistent. Perhaps should mimic an event object and use that
// in all cases
function fetchFeed(urlString, timeout, callback) {
  const request = new XMLHttpRequest();
  request.timeout = timeout;
  request.onerror = onError;
  request.ontimeout = onError;
  request.onabort = onError;
  request.onload = onLoad;
  request.open('GET', urlString, true);
  request.responseType = 'document';
  request.send();

  function onError(event) {
    const fetchEvent = {
      'type': event.type,
      'feed': null,
      'requestURLString': urlString,
      'responseURLString': event.target.responseURL
    };

    callback(fetchEvent);
  }

  function onLoad(event) {
    const document = event.target.responseXML;

    const fetchEvent = {
      'type': event.type,
      'feed': null,
      'requestURLString': urlString,
      'responseURLString': event.target.responseURL
    };

    // This can happen, for example, when fetching a PDF.
    // TODO: would document or documentElement ever actually be undefined?
    // If an error occurs, wouldn't that mean that onLoad doesn't even
    // get called? I need to look into this more.
    if(!document || !document.documentElement) {
      fetchEvent.type = 'invaliddocument';
      callback(fetchEvent);
      return;
    }

    // Parse the XMLDocument into a basic feed object
    // TODO: look into what exceptions are thrown by feedparser. Is it
    // an Error object or a string or a mix of things?

    try {
      fetchEvent.feed = FeedParser.parse(document);
      // TODO: responseURL may be different than requested url, I observed this
      // through logging, this should be handled here or by the caller somehow
      fetchEvent.feed.url = urlString;
      // TODO: this should be named dateFetched to be consistent with naming
      // of other date properties
      fetchEvent.feed.fetchDate = new Date();
    } catch(exception) {
      fetchEvent.type = 'parseexception';
      fetchEvent.details = exception;
    }

    callback(fetchEvent);
  }
}
