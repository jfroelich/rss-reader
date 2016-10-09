// See license.md

'use strict';

/*
TODO:
- use new fetch API
*/

{

function fetchHTML(requestURL, verbose, callback) {
  const log = new LoggingService();
  log.enabled = verbose;
  log.log('GET', requestURL.toString());
  const ctx = {
    'requestURL': requestURL,
    'callback': callback,
    'log': log
  };

  const request = new XMLHttpRequest();
  request.ontimeout = onTimeout.bind(ctx);
  request.onerror = onError.bind(ctx);
  request.onabort = onAbort.bind(ctx);
  request.onload = onLoad.bind(ctx);
  const isAsync = true;
  request.open('GET', requestURL.toString(), isAsync);
  request.responseType = 'document';
  request.setRequestHeader('Accept', 'text/html');
  request.send();
}

function onAbort(event) {
  this.log.debug('Aborted request', this.requestURL.toString());
  this.callback({'type': 'AbortError'});
}

function onError(event) {
  this.log.debug('Request error', this.requestURL.toString(),
    event.target.error);
  this.callback({'type': 'FetchError', 'status': event.target.status});
}

function onTimeout(event) {
  this.log.debug('Request timed out', this.requestURL.toString());
  this.callback({'type': 'TimeoutError'});
}

function onLoad(event) {
  this.log.debug('Loaded', this.requestURL.toString(), event.target.status);
  // doc is undefined for non-html
  const document = event.target.responseXML;
  if(!document) {
    return this.callback({'type': 'UndefinedDocumentError'});
  }

  const responseURL = new URL(event.target.responseURL);
  if(!responseURL) {
    throw new Error('missing response url');
  }

  this.callback({
    'type': 'success',
    'document': document,
    'responseURL': responseURL
  });
}

this.fetchHTML = fetchHTML;

}
