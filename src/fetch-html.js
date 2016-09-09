// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

{ // Begin file block scope

function fetchHTML(requestURL, timeoutMs, callback) {
  console.assert(requestURL && requestURL.href);
  console.log('GET', requestURL.href);

  const context = {
    'requestURL': requestURL,
    'callback': callback
  };

  const boundOnResponse = onResponse.bind(context);
  const isAsync = true;
  const request = new XMLHttpRequest();
  request.timeout = timeoutMs;
  request.ontimeout = boundOnResponse;
  request.onerror = boundOnResponse;
  request.onabort = boundOnResponse;
  request.onload = boundOnResponse;
  request.open('GET', requestURL.href, isAsync);
  request.responseType = 'document';
  request.setRequestHeader('Accept', 'text/html');
  request.send();
}

function onResponse(event) {
  if(event.type !== 'load') {
    this.callback({
      'type': 'FetchError',
      'requestURL': this.requestURL,
      'status': event.target.status
    });
    return;
  }

  // doc is undefined for pdfs and such
  const document = event.target.responseXML;
  if(!document) {
    this.callback({
      'type': 'UndefinedDocumentError',
      'requestURL': this.requestURL
    });
    return;
  }

  this.callback({
    'type': 'success',
    'requestURL': this.requestURL,
    'document': document,
    'responseURL': new URL(event.target.responseURL)
  });
}

this.fetchHTML = fetchHTML;

} // End file block scope
