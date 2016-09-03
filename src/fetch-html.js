// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

{ // Begin file block scope

function fetch_html(request_url, timeout_ms, callback) {
  console.assert(request_url && request_url.href);
  console.log('GET', request_url.href);

  const context = {
    'request_url': request_url,
    'callback': callback
  };

  const bound_on_response = on_response.bind(context);
  const async_flag = true;
  const request = new XMLHttpRequest();
  request.timeout = timeout_ms;
  request.ontimeout = bound_on_response;
  request.onerror = bound_on_response;
  request.onabort = bound_on_response;
  request.onload = bound_on_response;
  request.open('GET', request_url.href, async_flag);
  request.responseType = 'document';
  request.setRequestHeader('Accept', 'text/html');
  request.send();
}

function on_response(event) {
  if(event.type !== 'load') {
    this.callback({
      'type': 'FetchError',
      'requestURL': this.request_url,
      'status': event.target.status
    });
    return;
  }

  // doc is undefined for pdfs and such
  const document = event.target.responseXML;
  if(!document) {
    this.callback({
      'type': 'UndefinedDocumentError',
      'requestURL': this.request_url
    });
    return;
  }

  this.callback({
    'type': 'success',
    'requestURL': this.request_url,
    'document': document,
    'responseURL': new URL(event.target.responseURL)
  });
}

this.fetch_html = fetch_html;

} // End file block scope
