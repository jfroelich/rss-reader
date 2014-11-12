// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

var lucu = lucu || {};

/**
 * Fetches an HTML document. Passes the document and the
 * post-redirect url to the onComplete callback.
 *
 * TODO: if the debug logs work out below after some more testing,
 * I think this function should be entirely deprecated and this file
 * deleted.
 *
 * TODO: consider embedding iframe content?
 * TODO: consider sandboxing iframes?
 * TODO: html compression? like enforce boolean attributes? see kangax lib
 * TODO: scrubbing/html-tidy (e.g. remove images without src attribute?)
 */
lucu.fetchHTML = function(url, timeout, onComplete, onError) {
  'use strict';

  var request = new XMLHttpRequest();
  request.timeout = timeout;
  request.ontimeout = onError;
  request.onerror = function(event) {
    console.debug('fetch error');
    console.dir(event);
    onError(event);
  };
  request.onabort = onError;
  request.onload = function() {
    var document = this.responseXML;

    // TODO: do i need this guard?
    if(!document) {
      console.debug('%s yielded undefined document', this.responseURL);
      onError({type: 'invalid-document', target: this});
      return;
    }

    if(!document.body) {
      console.debug('%s yielded undefined body element', this.responseURL);
      onError({type: 'invalid-document', target: this});
      return;
    }

    // TODO: is there some attribute of document that can be set
    // to baseURL instead of passing it as a separate value?
    onComplete(document, this.responseURL);
  };

  request.open('GET', url, true);
  request.responseType = 'document';
  request.send();
};
