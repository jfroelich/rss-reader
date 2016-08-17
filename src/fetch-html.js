// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

{ // Begin file block scope

this.fetch_html = function(requestURL, timeoutMillis, callback) {
  console.assert(requestURL && requestURL.href);
  console.log('GET', requestURL.href);

  const context = {
    'requestURL': requestURL,
    'callback': callback
  };

  const bound_on_response = on_response.bind(context);
  const async_flag = true;
  const request = new XMLHttpRequest();
  request.timeout = timeoutMillis;
  request.ontimeout = bound_on_response;
  request.onerror = bound_on_response;
  request.onabort = bound_on_response;
  request.onload = bound_on_response;
  request.open('GET', requestURL.href, async_flag);
  request.responseType = 'document';
  request.setRequestHeader('Accept', 'text/html');
  request.send();
}

function on_response(event) {
  if(event.type !== 'load') {
    console.warn(event.type, event.target.status, event.target.statusText,
      this.requestURL.href);
    this.callback({'type': 'FetchError', 'requestURL': this.requestURL});
    return;
  }

  // doc is undefined for pdfs and such
  const document = event.target.responseXML;
  if(!document) {
    console.warn('Undefined document', this.requestURL.href);
    this.callback({'type': 'UndefinedDocumentError',
      'requestURL': this.requestURL});
    return;
  }

  this.callback({
    'type': 'success',
    'requestURL': this.requestURL,
    'document': document,
    'responseURL': new URL(event.target.responseURL)
  });
}

} // End file block scope
