// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

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
  var baseURI = lucu.uri.parse(baseURL);

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
    //console.debug('W %s H %s', remoteImage.width, remoteImage.height);
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
  if(lucu.uri.isDataURL(source)) {

    console.debug('data uri image without dimensions? %o', imageElement);


    // this certainly appears for data uris. i notice it is appearing when
    // width/height attribute not expressly set in html. maybe we just need to
    // read in the width/height property and set the attributes?
    // but wait, we never even reach reach is width is set. so width isnt
    // set for a data uri somehow. how in the hell does that happen?
    // is it because the element remains inert (according to how parseHTML works)?

    return false;
  }

  // We have a fetchable image with unknown dimensions
  // that we can augment
  return true;
}


/**
 * Returns the area of an image, in pixels. If the image's dimensions are
 * undefined, then returns undefined. If the image's dimensions are
 * greater than 800x600, then the area is clamped.
 */
function getImageArea(element) {
  // TODO: use offsetWidth and offsetHeight instead?
  if(element.width && element.height) {
    var area = element.width * element.height;

    // TODO: this clamping really should be done in the caller
    // and not here.

    // Clamp to 800x600
    if(area > 360000) {
      area = 360000;
    }

    return area;
  }

  return 0;
}


/**
 * Mutates an image element in place by changing its src property
 * to be a resolved url, and then returns the image element.
 *
 * NOTE: requires isDataURL from uri.js
 */
function resolveImageElement(baseURI, imageElement) {

  if(!baseURI) {
    return imageElement;
  }

  var sourceURL = (imageElement.getAttribute('src') || '').trim();

  // No source, so not resolvable
  if(!sourceURL) {
    return imageElement;
  }

  // this should not be resolving data: urls. Test and
  // exit early here. In at least one calling context,
  // augmentImages in http.js, it is not bothering to pre-filter
  // data: uri images before calling this function, so the
  // test has to be done here. i think it is better to do it here
  // than require the caller to avoid calling this on uri because
  // this does the attribute empty check.
  // note: in reality the URI module should be able to handle
  // this edge case and seamlessly work (calls to resolve would
  // be no ops). But the current URI module implementation is
  // shite so we have to check.

  if(lucu.uri.isDataURL(sourceURL)) {
    // console.debug('encountered data: url %s', sourceURL);
    return imageElement;
  }

  // NOTE: seeing GET resource://.....image.png errors in log.

  // TODO: I guess these should not be resolved either? Need to
  // learn more about resource URLs

  if(/^resource:/.test(sourceURL)) {
    console.debug('encountered resource: url %s', sourceURL);
    return imageElement;
  }

  var sourceURI = lucu.uri.parse(sourceURL);

  if(!sourceURI) {
    return imageElement;
  }

  // NOTE: this is not working correctly sometimes when resolving relative URLs
  // For example: GET http://example.compath/path.gif is missing leading slash

  // NOTE: resolveURI currently returns a string. In the future it should
  // return a URL, but that is not how it works right now, so we do not have
  // to convert the uri to a string explicitly here.
  var resolvedURL = lucu.uri.resolve(baseURI, sourceURI);

  if(resolvedURL == sourceURL) {
    // Resolving had no effect
    return imageElement;
  }

  imageElement.setAttribute('src', resolvedURL);

  return imageElement;
}
