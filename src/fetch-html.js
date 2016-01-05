// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

{ // BEGIN ANONYMOUS NAMESPACE

// TODO: maybe this should use more qualified and explict name like
// fetchHTMLDocument

// Fetches an HTML document (async) and passes the callback an error, the
// document object, and the response url string. The error argument is falsy
// when no error occurred.
function fetchHTML(url, timeout, callback) {
  const request = new XMLHttpRequest();
  request.timeout = timeout;

  // TODO: can I unify onFetchHTML and onFetchError, and have the single
  // function check something like event.type to determine whether it is
  // an error callback or a success callback?

  // TODO: is onerror a catch-all event that still is triggered when an abort
  // or a timeout occurs (and is that exclusive or not)?

  const errorCallback = onFetchError.bind(request, url, callback);
  request.ontimeout = errorCallback;
  request.onerror = errorCallback;
  request.onabort = errorCallback;

  request.onload = onFetchHTML.bind(request, url, callback);
  request.open('GET', url, true);

  // TODO: what is the default behavior? If responseType defaults
  // to document and by default fetches HTML, do we even need to specify
  // the type here?

  request.responseType = 'document';
  request.send();
}

this.fetchHTML = fetchHTML;

function onFetchError(url, callback, event) {
  const request = event.target;
  callback(event, request.responseXML, request.responseURL);
}

function onFetchHTML(url, callback, event) {
  const request = event.target;
  const document = request.responseXML;
  let error = null;

  if(!document || !document.documentElement) {

    // TODO: instead of creating an error object, this should create an event
    // object so that it is minimally consistent with the other types of the
    // first argument when the callback is called due to another type of error

    error = new Error('Undefined document or document element for url ' + url);
  }

  callback(error, document, request.responseURL);
}

} // END ANONYMOUS NAMESPACE
