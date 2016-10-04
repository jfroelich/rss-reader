// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// Set the width and height attributes of image elements. Calls back
// with the number of images modified. Async.
function SetImageDimensionsTask() {
  this.log = new LoggingService();
}

SetImageDimensionsTask.prototype.start = function(doc, callback) {
  const ctx = {
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
    this.onComplete(ctx);
    return;
  }

  ctx.numImages = images.length;
  for(let image of images) {
    this.processImage(ctx, image);
  }
};

SetImageDimensionsTask.prototype.processImage = function(ctx, image) {
  if(image.getAttribute('width') || image.getAttribute('height')) {
    return this.onProcessed(ctx);
  }

  if(this.inferFromStyle(image)) {
    ctx.numModified++;
    return this.onProcessed(ctx);
  }

  const src = image.getAttribute('src');
  if(!src) {
    return this.onProcessed(ctx);
  }

  const srcURL = this.parseURLNoRaise(src);
  if(!srcURL) {
    return this.onProcessed(ctx);
  }

  if(srcURL.protocol !== 'http:' && srcURL.protocol !== 'https:') {
    return this.onProcessed(ctx);
  }

  // Calling new Image creates the image in the current document context,
  // which is different than the document containing the image. The current
  // context is live, and will eagerly fetch images when the src property is
  // set. The document containing the image is inert, so setting its src would
  // not have an effect.
  const proxy = new Image();
  proxy.src = src;

  // If completed (cached) then use the available dimensions
  if(proxy.complete) {
    ctx.numModified++;
    image.setAttribute('width', proxy.width);
    image.setAttribute('height', proxy.height);
    return this.onProcessed(ctx);
  }

  // If incomplete then listen for response
  proxy.onload = this.onLoad.bind(this, ctx, image);
  proxy.onerror = this.onError.bind(this, ctx, image);
};

SetImageDimensionsTask.prototype.onError = function(ctx, image, event) {
  ctx.numFetched++;
  this.onProcessed(ctx);
};

SetImageDimensionsTask.prototype.onLoad = function(ctx, image, event) {
  ctx.numFetched++;
  image.setAttribute('width', event.target.width);
  image.setAttribute('height', event.target.height);
  ctx.numModified++;
  this.onProcessed(ctx);
};

SetImageDimensionsTask.prototype.onProcessed = function(ctx) {
  // This increment should only happen here, because this should only happen
  // once each call completes, which is sometimes asynchronous.
  ctx.numProcessed++;
  if(ctx.numProcessed === ctx.numImages) {
    this.onComplete(ctx);
  }
};

SetImageDimensionsTask.prototype.onComplete = function(ctx) {
  // remnant of a fixed bug
  if(ctx.didCallback) {
    throw new Error('duplicated callback');
  }

  ctx.didCallback = true;
  ctx.callback(ctx.numModified);
};

// Check if the dimensions are available from an inline style attribute
// This will trigger style computation, which is pretty damn slow, but that
// shouldn't matter too much given that this is async. Note that accessing
// the style property only looks at the inline style, as desired, which is
// different than getComputedStyle, which looks at the inherited properties
// too. Also note that image.style.width yields a string, such as "100%" or
// "50px", and this is the value set for the attribute.
SetImageDimensionsTask.prototype.inferFromStyle = function(image) {
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

SetImageDimensionsTask.prototype.parseURLNoRaise = function(urlString) {
  let urlObject = null;
  try {
    urlObject = new URL(urlString);
  } catch(error) {
  }
  return urlObject;
};
