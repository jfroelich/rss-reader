// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// Asynchronously fetches an html file
function fetchHTML(requestURL, timeoutMillis, callback) {
  console.assert(requestURL && requestURL.href,
    'requestURL is required and must be a URL object');
  console.log('GET', requestURL.href);

  const request = new XMLHttpRequest();
  if(timeoutMillis) {
    request.timeout = timeoutMillis;
  }

  const onFetch = fetchHTMLOnFetch.bind(request, requestURL, callback);
  request.ontimeout = onFetch;
  request.onerror = onFetch;
  request.onabort = onFetch;
  request.onload = onFetch;
  const isAsync = true;
  request.open('GET', requestURL.href, isAsync);
  request.responseType = 'document';
  request.setRequestHeader('Accept', 'text/html');
  request.send();
}

function fetchHTMLOnFetch(requestURL, callback, event) {
  if(event.type !== 'load') {
    console.warn(event.type, event.target.status, event.target.statusText,
      requestURL.href);
    callback({'type': 'FetchError', 'requestURL': requestURL});
    return;
  }

  // When XMLHttpRequest fetches a document that is not an XML/HTML document,
  // then the load was successful, but document is undefined.
  const document = event.target.responseXML;
  if(!document) {
    console.warn('Undefined document', requestURL.href);
    callback({'type': 'UndefinedDocumentError', 'requestURL': requestURL});
    return;
  }

  callback({
    'type': 'success',
    'requestURL': requestURL,
    'document': document,
    'responseURL': new URL(event.target.responseURL)
  });
}
