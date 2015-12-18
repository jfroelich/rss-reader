// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// Fetches an HTML document (async) and passes the callback an error, the
// document, and the response url string.
// TODO: unify the type of error. The native callbacks are events, but the
// undefined document creates an Error object.
// TODO: don't nest the function definition

function fetchHTML(url, timeout, callback) {
  'use strict';

  const request = new XMLHttpRequest();
  request.timeout = timeout;
  request.ontimeout = callback;
  request.onerror = callback;
  request.onabort = callback;

  request.onload = function _onload(event) {
    const request = event.target;
    const document = request.responseXML;

    if(!document || !document.documentElement) {
      callback(new Error('Undefined document'), document, request.responseURL);
      return;
    }

    callback(null, document, request.responseURL);
  };

  request.open('GET', url, true);
  request.responseType = 'document';
  request.send();
}
