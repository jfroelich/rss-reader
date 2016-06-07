// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

const ImageUtils = {};

// TODO: this is only ever called by polling and only for polling purposes,
// so I thinking of maybe integrating it back into poll.js. First I would
// like to refactor:
// - to decouple the async lib
// - to overall simplify the code, like i don't need the shouldFetch function
// - to use nested functions, I think I went a bit too extreme and didn't get
// much value for it

// Given a document, ensure that the width and height of each image element is
// set. If not set, fetch the image, check its dimensions, and explicitly set
// the width and height attributes of the image element within the html.
// TODO: stop using async lib, this is now i think the only place using it,
// and once i do that i can delete the lib
// TODO: track num fetched, errors
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
  // NOTE: I am confident Chrome permits the leading space. I am not so
  // confident about the trailing space.

  return /^\s*data\s*:/i.test(urlString);
};

// Request the image and set its dimensions
ImageUtils.fetchImage = function(imageElement, callback) {
  // Proxy is intentionally created within the local document
  // context because we know it is live. Chrome will eagerly fetch upon
  // changing the image element's src property.
  const sourceURLString = imageElement.getAttribute('src');
  const proxyImageElement = document.createElement('img');
  proxyImageElement.onload = onFetch;
  proxyImageElement.onerror = onFetch;
  proxyImageElement.src = sourceURLString;

  function onFetch(event) {
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
  }
};
