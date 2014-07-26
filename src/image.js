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
