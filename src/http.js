// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

/*
NOTE: i am not sure this module is correct, where to package
it, etc., but I am deferring that decision for now and
just making this into a basic 'thing'.

There are issues with the current approach. For example,
images are fetched in other places, feeds are fetched
in other places. So this module does not involve those,
but it is named and organized like it does. Which is bad.
I am intentionally ignoring this issue for now.

NOTE: not sure that this should also be doing the image
processing. maybe it should be the caller that does it.
I think right now that only fetch.js even uses this
so...

NOTE: I am not sure that this module should even exist
apart from fetch.js. maybe these are just fetch.js subroutines.
After all, only fetch.js uses this. So maybe this whole
module should be deprecated and split up into subroutines
of fetch.js

NOTE: i think the fact that there are so many parameters
to this function (ignoring the wrapper parameter object)
is a sign that it does too much.

*/


var lucu = lucu || {};
lucu.http = {};

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
 * TODO: use overrideMimeType instead of the content type check?
 * TODO: check for 404 and other status messages and handle those separately?
 * TODO: move image prefetching out of here to some type of caller, this should
 * only fetch
 *
 * TODO: one of the problems with fetching images before scrubbing is that
 * tracker gifs are pinged by the image loader. think of how to avoid stupid
 * requests like that
 *
 * Params is object with following properties
 * @param {string} url - the url to fetch
 * @param {function} onload - callback when completed without errors,
 * passed HTMLDocument object as only parameter
 * @param {function} onerror - callback when an error occurs that
 * prevents completion, such as abort, timeout, missing body tag, wrong content type
 * @param {integer} timeout - optional, ms
 * @param {boolean} augmentImageData - if true, will pre-fetch images
 * and store dimensions as html attributes.
 */
lucu.http.getHTML = function(params) {

  var request = new XMLHttpRequest();
  request.timeout = params.timeout;
  request.ontimeout = params.onerror;
  request.onerror = params.onerror;
  request.onabort = params.onerror;
  request.onload = lucu.http.onGetHTML.bind(request, params.onload,
    params.onerror, params.augmentImageData);
  request.open('GET', params.url, true);
  request.responseType = 'document';
  request.send();
};

lucu.http.onGetHTML = function(onComplete, onError, shouldAugmentImages, event) {

  var mime = lucu.mime.getType(this);

  if(!lucu.mime.isTextHTML(mime)) {
    return onError({type: 'invalid-content-type', target: this, contentType: mime});
  }

  if(!this.responseXML || !this.responseXML.body) {
    return onError({type: 'invalid-document', target: this});
  }

//  var SELECTOR_RESOLVABLE = 'a,applet,audio,embed,iframe,img,object,video';


  // NOTE: this uses the post-redirect url as the base url for anchors

  var baseURI = lucu.uri.parse(this.responseURL);
  var anchors = this.responseXML.body.querySelectorAll('a');
  var resolveAnchor = lucu.anchor.resolve.bind(null, baseURI);
  lucu.element.forEach(anchors, resolveAnchor);

  if(shouldAugmentImages) {
    // NOTE: this uses the post-redirect responseURL as the base url
    return lucu.image.augmentDocument(this.responseXML, this.responseURL, onComplete);
  }

  onComplete(this.responseXML);
};
