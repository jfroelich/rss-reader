// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// TODO: unify onFetchHTML and onFetchError, and have the single
// function check something like event.type to determine whether it is
// an error callback or a success callback?
// TODO: is onerror a catch-all event that still is triggered when an abort
// or a timeout occurs (and is that exclusive or not)?
// TODO: what is the default behavior of XMLHttpRequest? If responseType
// defaults to document and by default fetches HTML, do we even need to
// specify the type?
// TODO: instead of creating an error object when document is undefined, maybe
// this should create an event object so that it is minimally consistent with
// the other types of the first argument when the callback is called due to
// another type of error. I could use a plain javascript object with just the
// desired relevant properties, or I could research how to create custom
// events.

'use strict';

{ // BEGIN ANONYMOUS NAMESPACE

// Asynchronously fetches an HTML document and passes the callback an error,
// the document object, and the response url string. The error argument is
// falsy when no error occurred.
function fetchHTML(url, timeout, callback) {
  const request = new XMLHttpRequest();
  request.timeout = timeout;
  const errorCallback = onFetchError.bind(request, url, callback);
  request.ontimeout = errorCallback;
  request.onerror = errorCallback;
  request.onabort = errorCallback;
  request.onload = onFetchHTML.bind(request, url, callback);
  request.open('GET', url, true);
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
    error = new Error('Undefined document or document element for url ' + url);
  }

  callback(error, document, request.responseURL);
}

} // END ANONYMOUS NAMESPACE
