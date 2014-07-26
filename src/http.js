// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

/**
 * Fetches a webpage. Basically wraps an XMLHttpRequest.
 *
 * TODO: should we notify the callback of responseURL (is it
 * the url after redirects or is it the same url passed in?). i think
 * the onload callback should also receive responseURL. maybe onerror
 * should also receive responseURL if it is defined. that way the caller
 * can choose to also replace the original url
 * TODO: consider support for a fallback to plaintext
 * and recharacterizing this as fetchHTMLOrPlaintextDocument or something.
 * TODO: could this pass the xhr along instead of HTMLDocument? it works in
 * the normal case because caller ust accesses responseXML, but what about
 * if we provide the plaintext fallback?
 * TODO: consider an option to embed iframe content
 * TODO: consider an option to auto-sandboxing iframes
 * Params is object with following properties
 * @param {string} url - the url to fetch
 * @param {function} onload - callback when completed without errors,
 * passed HTMLDocument object as only parameter
 * @param {function} onerror - callback when an error occurs that
 * prevents completion, such as abort, timeout, missing body tag, wrong content type
 * @param {integer} timeout - optional, ms
 * @param {boolean} augmentImageData - if true, will also fetch images
 * and store dimensions as html attributes.
 */
function fetchHTMLDocument(params) {

  var request = new XMLHttpRequest();
  request.timeout = params.timeout;
  request.ontimeout = params.onerror;
  request.onerror = params.onerror;
  request.onabort = params.onerror;
  request.onload = onHTMLDocumentLoad.bind(request, params.onload,
      params.onerror, params.augmentImageData);
  request.open('GET', params.url, true);
  request.responseType = 'document';
  request.send();
}

function onHTMLDocumentLoad(onComplete, onError, shouldAugmentImages, event) {

  var contentType = this.getResponseHeader('Content-Type');

  if(!isContentTypeHTML(contentType)) {
    return onError({
      type: 'invalid-content-type',
      target: this,
      contentType: contentType
    });
  }

  if(!this.responseXML || !this.responseXML.body) {
    return onError({
      type: 'invalid-document',
      target: this
    });
  }

  // NOTE: this uses the post-redirect url as the base url for anchors
  var baseURI = lucu.uri.parse(this.responseURL);
  var anchors = this.responseXML.body.querySelectorAll('a');
  Array.prototype.forEach.call(anchors, resolveAnchorElement.bind(null, baseURI));

  if(shouldAugmentImages) {
    // NOTE: this uses the post-redirect responseURL as the base url
    return augmentImages(this.responseXML, this.responseURL, onComplete);
  }

  onComplete(this.responseXML);
}
