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

  //if(this.responseURL != params.url) {
  //  console.log('originalURL %s responseURL %s', params.url, this.responseURL);
  //}

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

  if(shouldAugmentImages) {

    // NOTE: this uses the post-redirect responseURL as the base
    // url
    return augmentImages(this.responseXML, this.responseURL, onComplete);
  }

  onComplete(this.responseXML);
}

/**
 * Set dimensions for image elements that are missing dimensions.
 *
 * TODO: move to a diff file?
 * TODO: srcset, picture (image families)
 * TODO: just accept an xhr instead of doc + baseURL?
 *
 * @param doc {HTMLDocument} an HTMLDocument object to inspect
 * @param baseURL {string} for resolving image urls
 * @param oncomplete {function}
 */
function augmentImages(doc, baseURL, onComplete) {

  var allBodyImages = doc.body.getElementsByTagName('img');

  // TODO: parse base URL here.
  // NOTE: we cannot exit early here if missing base url. All images
  // could be absolute and still need to be loaded. Rather, a missing
  // baseURL just means we should skip the resolve step

  var resolvedImages;
  var baseURI = parseURI(baseURL);

  if(baseURI) {
    resolvedImages = Array.prototype.map.call(allBodyImages,
      resolveImageElement.bind(null, baseURI));
  } else {
    resolvedImages = Array.prototype.slice.call(allBodyImages);
  }

  // Filter out data-uri images, images without src urls, and images
  // with dimensions, to obtain a subset of images that are augmentable
  var loadableImages = resolvedImages.filter(isAugmentableImage);

  var numImagesToLoad = loadableImages.length;

  if(numImagesToLoad === 0) {
    return onComplete(doc);
  }

  // NOTE: rather than using forEach and numImages check, see if there is some type
  // of async technique that empties a queue and calls onComplete when queue is empty

  loadableImages.forEach(fetchAndSetImageDimensions.bind(null, dispatchIfComplete));

  function dispatchIfComplete() {
    if(--numImagesToLoad === 0) {
      onComplete(doc);
    }
  }
}


function fetchAndSetImageDimensions(onComplete, remoteImage) {

  // Nothing happens when changing the src property of an HTMLImageElement
  // that is located in a foreign Document context. Therefore we have to
  // create an image element within the local document context for each
  // image in the remote context (technically we could reuse one local
  // element). Rather than creating new ones, we can just import the
  // remote, which does a shallow element clone from remote to local.

  // TODO: does this cause an immediate fetch?

  var localImage = document.importNode(remoteImage, false);

  // If a problem occurs just go straight to onComplete and do not load
  // the image or augment it.
  localImage.onerror = onComplete;

  localImage.onload = function() {

    // Modify the remote image properties according to
    // the local image properties
    remoteImage.width = this.width;
    remoteImage.height = this.height;
    //console.log('W %s H %s', remoteImage.width, remoteImage.height);
    onComplete();
  };

  // Setting the src property is what triggers the fetch. Unfortunately
  // the 'set' operation is ignored unless the new value is different
  // than the old value.
  var src = localImage.src;
  localImage.src = void src;
  localImage.src = src;
}

function isAugmentableImage(imageElement) {

  if(imageElement.width) {
    return false;
  }

  var source = (imageElement.getAttribute('src') || '').trim();

  if(!source) {
    return false;
  }

  // I assume dimensions for data uris are set when the data uri is
  // parsed, because it essentially represents an already loaded
  // image. However, we want to make sure we do not try to fetch
  // such images
  if(isDataURL(source)) {

    console.log('data uri image without dimensions? %o', imageElement);

    return false;
  }

  // We have a fetchable image with unknown dimensions
  // that we can augment
  return true;
}

function isContentTypeFeed(contentType) {
  return /(application|text)\/(atom|rdf|rss)?\+?xml/i.test(contentType);
}

function isContentTypeHTML(contentType) {
  return /text\/html/i.test(contentType);
}

function isContentTypeText(contentType) {
  return /text\/plain/i.test(contentType);
}

function isContentTypeHTMLOrText(contentType) {
  return /text\/(plain|html)/i.test(contentType);
}
