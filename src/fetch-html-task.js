// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// TODO: use new fetch API internally

function FetchHTMLTask() {
  this.log = new LoggingService();
}

FetchHTMLTask.prototype.start = function(requestURL, timeoutMs, callback) {
  this.log.log('GET', requestURL.href);

  const ctx = {
    'requestURL': requestURL,
    'callback': callback
  };

  const request = new XMLHttpRequest();
  request.timeout = timeoutMs;
  request.ontimeout = this._onTimeout.bind(this, ctx);
  request.onerror = this._onError.bind(this, ctx);
  request.onabort = this._onAbort.bind(this, ctx);
  request.onload = this._onLoad.bind(this, ctx);
  const isAsync = true;
  request.open('GET', requestURL.href, isAsync);
  request.responseType = 'document';
  request.setRequestHeader('Accept', 'text/html');
  request.send();
};

FetchHTMLTask.prototype._onError = function(ctx, event) {
  ctx.callback({
    'type': 'FetchError',
    'status': event.target.status
  });
};

FetchHTMLTask.prototype._onTimeout = function(ctx, event) {
  ctx.callback({
    'type': 'TimeoutError'
  });
};

FetchHTMLTask.prototype._onAbort = function(ctx, event) {
  ctx.callback({
    'type': 'AbortError'
  });
};

FetchHTMLTask.prototype._onLoad = function(ctx, event) {
  // doc is undefined for non-html
  const document = event.target.responseXML;
  if(!document) {
    ctx.callback({
      'type': 'UndefinedDocumentError'
    });
    return;
  }

  const responseURL = new URL(event.target.responseURL);
  // This should never happen
  if(!responseURL) {
    throw new Error('missing response url');
  }

  ctx.callback({
    'type': 'success',
    'document': document,
    'responseURL': responseURL
  });
};
