// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

var rdr = rdr || {};
rdr.poll = rdr.poll || {};

rdr.poll.fetchHTML.start = function(requestURL, timeoutMs, callback) {
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
  request.ontimeout = rdr.poll.fetchHTML.onTimeout.bind(context);
  request.onerror = rdr.poll.fetchHTML.onError.bind(context);
  request.onabort = rdr.poll.fetchHTML.onAbort.bind(context);
  request.onload = rdr.poll.fetchHTML.onLoad.bind(context);
  request.open('GET', requestURL.href, isAsync);
  request.responseType = 'document';
  request.setRequestHeader('Accept', 'text/html');
  request.send();
};

rdr.poll.fetchHTML.onError = function(event) {
  this.callback({
    'type': 'FetchError',
    'status': event.target.status
  });
};

rdr.poll.fetchHTML.onTimeout = function(event) {
  this.callback({
    'type': 'TimeoutError'
  });
};

rdr.poll.fetchHTML.onAbort = function(event) {
  this.callback({
    'type': 'AbortError'
  });
};

rdr.poll.fetchHTML.onLoad = function(event) {
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
};
