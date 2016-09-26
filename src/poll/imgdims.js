// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

var rdr = rdr || {};
rdr.poll = rdr.poll || {};
rdr.poll.imgdims = {};

// Set the width and height attributes of image elements. Calls back
// with the number of images modified.
rdr.poll.imgdims.updateImages = function(doc, callback) {
  const context = {
    'numProcessed': 0,
    'numFetched': 0,
    'numModified': 0,
    'numImages': 0,
    'callback': callback,
    'doc': doc,
    'didCallback': false
  };

  const images = doc.getElementsByTagName('img');
  if(!images.length) {
    rdr.poll.imgdims.onComplete.call(context);
    return;
  }

  context.numImages = images.length;
  for(let image of images) {
    rdr.poll.imgdims.setDimensions.call(context, image);
  }
};

rdr.poll.imgdims.setDimensions = function(image) {
  if(image.getAttribute('width') || image.getAttribute('height')) {
    return rdr.poll.imgdims.onProcessed.call(this);
  }

  if(rdr.poll.imgdims.inferFromStyle(image)) {
    this.numModified++;
    return rdr.poll.imgdims.onProcessed.call(this);
  }

  const src = image.getAttribute('src');
  if(!src) {
    return rdr.poll.imgdims.onProcessed.call(this);
  }

  const srcURL = rdr.poll.imgdims.parseURLNoRaise(src);
  if(!srcURL) {
    return rdr.poll.imgdims.onProcessed.call(this);
  }

  if(srcURL.protocol !== 'http:' && srcURL.protocol !== 'https:') {
    rdr.poll.imgdims.onProcessed.call(this);
    return;
  }

  // Calling new Image creates the image in the current document context,
  // which is different than the document containing the image. The current
  // context is live, and will eagerly fetch images when the src property is
  // set. The document containing the image is inert, so setting its src would
  // not have an effect.
  const proxyImage = new Image();
  proxyImage.src = src;

  // If completed (cached) then use the available dimensions
  if(proxyImage.complete) {
    this.numModified++;
    image.setAttribute('width', proxyImage.width);
    image.setAttribute('height', proxyImage.height);
    return rdr.poll.imgdims.onProcessed.call(this);
  }

  // If incomplete then listen for response
  proxyImage.onload = rdr.poll.imgdims.onLoad.bind(this, image);
  proxyImage.onerror = rdr.poll.imgdims.onError.bind(this, image);

};

rdr.poll.imgdims.onError = function(image, event) {
  this.numFetched++;
  rdr.poll.imgdims.onProcessed.call(this);
};

rdr.poll.imgdims.onLoad = function(image, event) {
  this.numFetched++;
  image.setAttribute('width', event.target.width);
  image.setAttribute('height', event.target.height);
  this.numModified++;
  rdr.poll.imgdims.onProcessed.call(this);
};

rdr.poll.imgdims.onProcessed = function() {
  // This increment should only happen here, because this should only happen
  // once each call completes, which is sometimes asynchronous.
  this.numProcessed++;
  if(this.numProcessed === this.numImages) {
    rdr.poll.imgdims.onComplete.call(this);
  }
};

rdr.poll.imgdims.onComplete = function() {

  // remnant of a fixed bug
  if(this.didCallback) {
    throw new Error('duplicated callback');
  }

  this.didCallback = true;
  this.callback(this.numModified);
};

// Check if the dimensions are available from an inline style attribute
// This will trigger style computation, which is pretty damn slow, but that
// shouldn't matter too much given that this is async. Note that accessing
// the style property only looks at the inline style, as desired, which is
// different than getComputedStyle, which looks at the inherited properties
// too. Also note that image.style.width yields a string, such as "100%" or
// "50px", and this is the value set for the attribute.
rdr.poll.imgdims.inferFromStyle = function(image) {
  let dirtied = false;
  if(image.hasAttribute('style')) {
    if(image.style.width) {
      image.setAttribute('width', image.style.width);
      dirtied = true;
    }
    if(image.style.height) {
      image.setAttribute('height', image.style.height);
      dirtied = true;
    }
  }
  return dirtied;
};

// TODO: maybe elevate to a shared utility
rdr.poll.imgdims.parseURLNoRaise = function(urlString) {
  let urlObject = null;
  try {
    urlObject = new URL(urlString);
  } catch(error) {
  }
  return urlObject;
};
