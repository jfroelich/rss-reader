// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

{ // Begin file block scope

function fetchHTML(requestURL, timeoutMs, callback) {
  console.assert(requestURL);
  console.assert(requestURL.href);
  console.log('GET', requestURL.href);

  const context = {
    'requestURL': requestURL,
    'callback': callback
  };

  const isAsync = true;
  const request = new XMLHttpRequest();
  request.timeout = timeoutMs;
  request.ontimeout = onTimeout.bind(context);
  request.onerror = onError.bind(context);
  request.onabort = onAbort.bind(context);
  request.onload = onLoad.bind(context);
  request.open('GET', requestURL.href, isAsync);
  request.responseType = 'document';
  request.setRequestHeader('Accept', 'text/html');
  request.send();
}

function onError(event) {
  this.callback({
    'type': 'FetchError',
    'status': event.target.status
  });
}

function onTimeout(event) {
  this.callback({
    'type': 'TimeoutError'
  });
}

function onAbort(event) {
  this.callback({
    'type': 'AbortError'
  });
}

function onLoad(event) {
  // doc is undefined for pdfs and such
  const document = event.target.responseXML;
  if(!document) {
    this.callback({
      'type': 'UndefinedDocumentError'
    });
    return;
  }

  this.callback({
    'type': 'success',
    'document': document,
    'responseURL': new URL(event.target.responseURL)
  });
}

this.fetchHTML = fetchHTML;

} // End file block scope
