// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

var lucu = lucu || {};

/**
 * Fetches an HTML document. Passes the document and the
 * post-redirect url to the onComplete callback.
 *
 * TODO: use overrideMimeType to avoid the need for a fallback
 * and to allow the normal onerror to be triggered. Then deprecate
 * the content type check?
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
  request.onerror = onError;
  request.onabort = onError;

  request.onload = function() {
    var mimeType = this.getResponseHeader('Content-Type');

    if(!/text\/html/i.test(mimeType)) {
      onError({type: 'invalid-content-type', target: this, contentType: mimeType});
      return;
    }

    var document = this.responseXML;

    if(!document || !document.body) {
      onError({type: 'invalid-document', target: this});
      return;
    }

    var baseURL = this.responseURL;
    // TODO: is resolution integral to fetch? Or should this be the
    // caller's responsibility?
    lucu.resolveElements(document, baseURL);

    // Pass back responseURL so caller can consider
    // doing something with the post-redirect url.
    // TODO: is there some attribute of document that can be set
    // to baseURL instead of passing it as a separate value?
    onComplete(document, baseURL);
  };

  request.open('GET', url, true);
  request.responseType = 'document';
  request.send();
};
