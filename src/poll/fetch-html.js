// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

var rdr = rdr || {};
rdr.poll = rdr.poll || {};
rdr.poll.fetchHTML = {};

rdr.poll.fetchHTML.start = function(requestURL, timeoutMs, callback, verbose) {

  if(!rdr.utils.isURLObject(requestURL)) {
    throw new TypeError('invalid requestURL param: ' + requestURL);
  }

  if(verbose) {
    console.log('GET', requestURL.href);
  }

  const ctx = {
    'requestURL': requestURL,
    'callback': callback,
    'verbose': verbose
  };

  const isAsync = true;
  const request = new XMLHttpRequest();
  request.timeout = timeoutMs;
  request.ontimeout = rdr.poll.fetchHTML.onTimeout.bind(ctx);
  request.onerror = rdr.poll.fetchHTML.onError.bind(ctx);
  request.onabort = rdr.poll.fetchHTML.onAbort.bind(ctx);
  request.onload = rdr.poll.fetchHTML.onLoad.bind(ctx);
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
