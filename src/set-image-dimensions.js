// See license.md

'use strict';

{

function setImageDimensions(doc, verbose, callback) {
  const log = verbose ? console : SilentConsole;

  // TODO: print baseURI or something more informative
  log.log('Setting image dimensions for document');

  const ctx = {
    'numProcessed': 0,
    'numFetched': 0,
    'numModified': 0,
    'numImages': 0,
    'callback': callback,
    'doc': doc,
    'didCallback': false,
    'log': log
  };

  const images = doc.getElementsByTagName('img');
  if(!images.length) {
    onComplete.call(ctx);
    return;
  }

  ctx.numImages = images.length;
  for(let image of images) {
    processImage.call(ctx, image);
  }
}

function processImage(image) {
  if(image.getAttribute('width') || image.getAttribute('height')) {
    return onProcessed.call(this);
  }

  if(inferFromStyle(image)) {
    this.numModified++;
    return onProcessed.call(this);
  }

  const src = image.getAttribute('src');
  if(!src) {
    return onProcessed.call(this);
  }

  const srcURL = parseURLNoRaise(src);
  if(!srcURL) {
    return onProcessed.call(this);
  }

  if(srcURL.protocol !== 'http:' && srcURL.protocol !== 'https:') {
    return onProcessed.call(this);
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
    this.numModified++;
    image.setAttribute('width', proxy.width);
    image.setAttribute('height', proxy.height);
    return onProcessed.call(this);
  }

  // If incomplete then listen for response
  proxy.onload = onLoad.bind(this, image);
  proxy.onerror = onError.bind(this, image);
};

function onError(image, event) {
  this.numFetched++;
  onProcessed.call(this);
}

function onLoad(image, event) {
  this.numFetched++;
  image.setAttribute('width', event.target.width);
  image.setAttribute('height', event.target.height);
  this.numModified++;
  onProcessed.call(this);
}

function onProcessed() {
  // This increment should only happen here, because this should only happen
  // once each call completes, which is sometimes asynchronous.
  this.numProcessed++;
  if(this.numProcessed === this.numImages) {
    onComplete.call(this);
  }
}

function onComplete() {
  // remnant of a fixed bug
  if(this.didCallback) {
    throw new Error('duplicated callback');
  }

  this.didCallback = true;
  this.callback(this.numModified);
}

// Check if the dimensions are available from an inline style attribute
// This will trigger style computation, which is pretty damn slow, but that
// shouldn't matter too much given that this is async. Note that accessing
// the style property only looks at the inline style, as desired, which is
// different than getComputedStyle, which looks at the inherited properties
// too. Also note that image.style.width yields a string, such as "100%" or
// "50px", and this is the value set for the attribute.
function inferFromStyle(image) {
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
}

function parseURLNoRaise(urlString) {
  let urlObject = null;
  try { urlObject = new URL(urlString); } catch(error) {}
  return urlObject;
}

this.setImageDimensions = setImageDimensions;

}
