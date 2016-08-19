// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

{ // Begin file block scope

this.fetch_feed = function(requestURL, timeoutMillis, excludeEntries,
  callback) {
  console.assert(isURL(requestURL));
  console.assert(typeof timeoutMillis === 'undefined' ||
    (!isNaN(timeoutMillis) && isFinite(timeoutMillis) && timeoutMillis >= 0));

  console.debug('GET', requestURL.href);

  const context = {
    'requestURL': requestURL,
    'excludeEntries': excludeEntries,
    'callback': callback
  };

  const bound_on_response = on_response.bind(context);
  const async_flag = true;
  const request = new XMLHttpRequest();
  request.timeout = timeoutMillis;
  request.onerror = bound_on_response;
  request.ontimeout = bound_on_response;
  request.onabort = bound_on_response;
  request.onload = bound_on_response;
  request.open('GET', requestURL.href, async_flag);
  request.responseType = 'document';
  request.send();
};

function on_response(event) {
  // Check that we got a load response
  if(event.type !== 'load') {
    console.debug(event.type, requestURL.href);
    this.callback({'type': event.type, 'requestURL': this.requestURL});
    return;
  }

  // Doc is undefined for pdfs and such
  const document = event.target.responseXML;
  if(!document) {
    this.callback({
      'type': 'UndefinedDocumentError',
      'requestURL': this.requestURL
    });
    return;
  }

  let feed = null;
  try {
    feed = parse_feed(document, this.excludeEntries);
  } catch(error) {
    console.warn(this.requestURL.href, error.message);
    this.callback({'type': 'ParseError', 'message': error.message,
      'requestURL': this.requestURL});
    return;
  }

  feed.add_url(this.requestURL);
  feed.add_url(new URL(event.target.responseURL));
  feed.dateFetched = new Date();

  const lastModified = event.target.getResponseHeader('Last-Modified');
  if(lastModified) {
    try {
      feed.dateLastModified = new Date(lastModified);
    } catch(error) {
    }
  }

  this.callback({'type': 'load', 'feed': feed, 'requestURL': this.requestURL});
}

function isURL(value) {
  return Object.prototype.toString.call(value) === '[object URL]';
}

} // End file block scope
