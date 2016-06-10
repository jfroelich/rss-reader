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
// TODO: rename url to urlString, or consider requiring a URL object instead of
// a string.
function fetchFeed(url, timeout, callback) {
  const request = new XMLHttpRequest();
  request.timeout = timeout;
  request.onerror = callbackWithErrorEvent;
  request.ontimeout = callbackWithErrorEvent;
  request.onabort = callbackWithErrorEvent;
  request.onload = onLoad;
  request.open('GET', url, true);
  request.responseType = 'document';
  request.send();

  function callbackWithErrorEvent(event) {
    callback(event, null, event.target.responseURL);
  }

  function onLoad(event) {
    const document = request.responseXML;

    // TODO: would document or documentElement ever actually be undefined?
    // If an error occurs, wouldn't that mean that onLoad doesn't even
    // get called? I need to look into this more.
    if(!document) {
      callback(event, document, request.responseURL);
      return;
    }

    // This can happen, for example, when fetching a PDF.
    if(!document.documentElement) {
      callback(event, document, request.responseURL);
      return;
    }

    // NOTE: I am not sure this ever happens actually. This happens when
    // doing it myself with DOMParser.parseFromString, but I think if this
    // happens in XMLHttpRequest then something else occurs, like a fetch
    // error? So maybe this is dumb.
    const parserError = document.querySelector('parsererror');
    if(parserError) {
      console.debug(parserError.outerHTML);
      parserError.remove();
    }

    // Parse the XMLDocument into a basic feed object
    let feed = null;
    try {
      feed = FeedParser.parse(document);
    } catch(exception) {
      callback(exception, null, request.responseURL);
      return;
    }

    // Set some implicit properties of the fetched feed that pertain to this
    // operation of fetching
    // TODO: responseURL may be different than requested url, I observed this
    // through logging, this should be handled here or by the caller somehow
    feed.url = url;

    // TODO: this should be named dateFetched to be consistent with naming
    // of other date properties
    feed.fetchDate = new Date();

    // Using null as the first parameter to callback indicates that no error
    // occurred
    callback(null, feed, request.responseURL);
  }
}
