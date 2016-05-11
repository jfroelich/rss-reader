// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// Requires: /lib/async.js
// Requires: /src/utils.js
// TODO: stop using async lib
// TODO: track num fetched, errors

const ImageUtils = {};

// Given a document, ensure that the width and height of each image element is
// set. If not set, fetch the image, check its dimensions, and explicitly set
// the width and height attributes of the image element within the html.
ImageUtils.fetchDimensions = function(document, callback) {
  // TODO: maybe I should fallback to documentElement here?
  const bodyElement = document.body;
  if(!bodyElement) {
    // The callback expects no args
    callback();
    return;
  }

  const imageNodeList = bodyElement.getElementsByTagName('img');
  const fetchables = Array.prototype.filter.call(imageNodeList,
    ImageUtils.shouldFetch);
  async.forEach(fetchables, ImageUtils.fetchImage, callback);
};

// Returns whether the image should be fetched.
// TODO: should I also check attributes?
ImageUtils.shouldFetch = function(imageElement) {
  // TODO: maybe I should always fetch dimensions for images with urls?
  // How much of a benefit it is to reduce the number of fetches?
  // Why do I even want to keep the original dimensions? I am using CSS to
  // restrict the widths on render. Put some more thought into this to clarify
  // the rationale.

  // Checking width is sufficient to determine whether the image has
  // dimensions. I think. I am a bit tentative about it.

  // TODO: as an aside, why am I checking for presence of URL here? Shouldn't
  // images without URLs already have been handled by this point? Or is it
  // better to be redundant and make fewer assumptions about other code and
  // the timing of when it is called.

  let url = imageElement.getAttribute('src') || '';
  url = url.trim();
  return url && !ImageUtils.isObjectURL(url) && !imageElement.width;
};

ImageUtils.isObjectURL = function(urlString) {
  return /^\s*data\s*:/i.test(urlString);
};

// Request the image.
ImageUtils.fetchImage = (imageElement, callback) {
  // Proxy is intentionally created within the local document
  // context. We know it is live, so Chrome will eagerly fetch upon
  // changing the image element's src property. We do not know if the
  // input image resides in an live or inert document, so we cannot
  // safely expect that creating the proxy within its document, accessed
  // via imageElement.ownerDocument, would even do anything.
  // We know urlString is defined because it was checked before calling.
  const sourceURLString = imageElement.getAttribute('src');
  const proxyImageElement = document.createElement('img');
  proxyImageElement.onload = onFetch;
  proxyImageElement.onerror = onFetch;
  // Setting the source triggers the fetch within the context of a live
  // document. We are using the document containing this script so we know
  // that proxy is located in a live context.
  proxyImageElement.src = sourceURLString;

  // TODO: rather than wrap, this just should call it directly
  function onFetch(event) {
    ImageUtils.onFetch(imageElement, callback, event);
  }
};

// On requesting the image, if successful, update the attributes of the
// local image.
ImageUtils.onFetch = function(imageElement, callback, event) {
  if(event.type === 'load') {
    const proxyImageElement = event.target;

    // Set the attributes, not the properties. The properties will be set
    // by setting the attributes. Setting properties will not set the
    // attributes. If any code does any serialization/deserialization to or
    // from innerHTML, it would not store the new values if I only set the
    // properties.

    imageElement.setAttribute('width', proxyImageElement.width);
    imageElement.setAttribute('height', proxyImageElement.height);

  } else {
    // NOTE: Tentatively not logging this error message. It definitely
    // happens and is leading to lots of log messages sometimes so I am
    // disabling it until I return to work on this feature.
    //const sourceURLString = imageElement.getAttribute('src');
    //console.debug('Failed to fetch image:', sourceURLString);
  }

  // Callback with no args to signal async.forEach to continue.
  callback();
};

// Modify the src values of images that appear to be lazily loaded.
// TODO: maybe skip an image if image.closest('picture') ?
ImageUtils.transformLazilyLoadedImages = function(document) {
  const bodyElement = document.body;
  if(!bodyElement) {
    return;
  }

  const imageNodeList = bodyElement.querySelectorAll('img');
  const listLength = imageNodeList.length;
  for(let i = 0; i < listLength; i++) {
    ImageUtils.transformLazilyLoadedImage(imageNodeList[i]);
  }
};

// TODO: reduce the DRYness of this function
ImageUtils.transformLazilyLoadedImage = function(image) {

  // TODO: support this case better. There is a problem here because
  // the tiny image filter is picking this up and removing it.
  /*
<img data-thumb="url" data-full-size-image="url" data-lar
ge-size-image="url" data-trigger-notification="1" data-scalable="fa
lse" alt="" data-src="url" data-tc-lazyload="deferred" src="url" width=
"1" height="1">
  */

  if(!image.hasAttribute('src') && image.hasAttribute('load-src')) {
    image.setAttribute('src', image.getAttribute('load-src'));
    return;
  }

  if(image.hasAttribute('data-src') &&
    image.classList.contains('lazy-image')) {
    image.setAttribute('src', image.getAttribute('data-src'));
    return;
  }

  if(!image.hasAttribute('src') && image.hasAttribute('data-src')) {
    image.setAttribute('src', image.getAttribute('data-src'));
    return;
  }

  // TODO: responsive design conflicts with the approach this takes,
  // this needs to be handled instead by the srcset handler?
  if(!image.hasAttribute('src') &&
    image.hasAttribute('data-original-desktop')) {
    image.setAttribute('src', image.getAttribute('data-original-desktop'));
    return;
  }

  if(!image.hasAttribute('src') && image.hasAttribute('data-baseurl')) {
    image.setAttribute('src', image.getAttribute('data-baseurl'));
    return;
  }

  if(!image.hasAttribute('src') && image.hasAttribute('data-lazy')) {
    image.setAttribute('src', image.getAttribute('data-lazy'));
    return;
  }

  if(!image.hasAttribute('src') && image.hasAttribute('data-img-src')) {
    image.setAttribute('src', image.getAttribute('data-img-src'));
    return;
  }

  if(!image.hasAttribute('src') && image.hasAttribute('data-original')) {
    image.setAttribute('src', image.getAttribute('data-original'));
    return;
  }

  if(!image.hasAttribute('src') && image.hasAttribute('data-adaptive-img')) {
    image.setAttribute('src', image.getAttribute('data-adaptive-img'));
    return;
  }
};
