// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// Set the width and height attributes of image elements. Async. Calls back
// with the number of images modified.
function setImageDimensions(document, callback) {
  const context = {
    'numProcessed': 0,
    'numFetched': 0,
    'numModified': 0,
    'numImages': 0,
    'callback': callback,
    'document': document,
    'didCallback': false
  };

  // Because we are not modifying the set of images, it makes sense to use
  // getElementsByTagName here instead of querySelectorAll, just because of
  // the minor speed boost. This is admittedly a technicality.

  const images = document.getElementsByTagName('img');
  context.numImages = images.length;
  if(context.numImages) {
    for(let image of images) {
      setImageDimensionsProcessImage(context, image);
    }
  } else {
    // Ensure we still callback in the case of no images
    callback(0);
  }
}

function setImageDimensionsProcessImage(context, image) {
  // Skip images with at least one dimension. Check against the attributes, not
  // the properties, because the properties may not have been set for some
  // reason (e.g. inert document context)
  if(image.getAttribute('width') || image.getAttribute('height')) {
    setImageDimensionsOnImageProcessed(context);
    return;
  }

  // Check if the dimensions are available from an inline style attribute
  // This will trigger style computation, which is pretty damn slow, but that
  // shouldn't matter too much given that this is async.

  // TODO: possible bug in the case of "style="width: 100%; height: 100%;"

  if(image.hasAttribute('style') && (image.style.width || image.style.height)) {
    console.debug('Inferring dimensions from inline style', image.outerHTML,
      image.style.width, image.style.height);
    image.setAttribute('width', image.style.width);
    image.setAttribute('height', image.style.height);
    setImageDimensionsOnImageProcessed(context);
    return;
  }

  // Skip images without a src attribute because we cannot load such images.
  // These images should probably already have been processed elsewhere and
  // probably removed, but it doesn't hurt to redundantly check here.
  const src = image.getAttribute('src');
  if(!src) {
    setImageDimensionsOnImageProcessed(context);
    return;
  }

  // Skip images with invalid src urls
  let srcURL = null;
  try {
    srcURL = new URL(src);
  } catch(urlParseError) {
    console.debug('Invalid url', image.outerHTML);
    setImageDimensionsOnImageProcessed(context);
    return;
  }

  // Skip non-http/s images. This usually means object urls.
  // Even though object urls are available and the dimensions of
  // such an image could probably have been set, I am not seeing any properties
  if(srcURL.protocol !== 'http:' && srcURL.protocol !== 'https:') {
    setImageDimensionsOnImageProcessed(context);
    return;
  }

  // Calling new Image creates the image in the current document context,
  // which is different than the document containing the image. The current
  // context is live, and will eagerly fetch images when the src property is
  // set.
  const proxyImage = new Image();
  proxyImage.src = src;

  // Check if the proxy is complete. Inferrably, when setting the src property,
  // Chrome also checked whether the image was cached. In this case, the
  // dimensions are already available. Furthermore, the load/error events may
  // never fire. Also, I now no longer even bind the listeners if the proxy
  // is complete.
  if(proxyImage.complete) {
    // Inform the load/error callback that the processing already occurred.
    // Even though I no longer even bind the listeners
    proxyImage.setAttribute('cached', '1');
    image.setAttribute('width', proxyImage.width);
    image.setAttribute('height', proxyImage.height);
    setImageDimensionsOnImageProcessed(context);
  } else {
    // Track the number of fetch calls. Only increment if not cached.
    context.numFetched++;

    // Attach the listeners. Even though we attach after setting the src, this
    // should not matter, because the listeners do not have to be already
    // bound. It is similar to calling then on a fulfilled promise.
    const onLoad = setImageDimensionsOnLoad.bind(proxyImage, context, image);
    proxyImage.onload = onLoad;
    proxyImage.onerror = onLoad;
  }
}

function setImageDimensionsOnLoad(context, image, event) {
  // This image was already processed, so ignore the event.
  if(event.target.hasAttribute('cached')) {
    console.debug('Suppressing on load, image was cached');
    return;
  }

  if(event.type === 'load') {
    image.setAttribute('width', event.target.width);
    image.setAttribute('height', event.target.height);
    context.numModified++;
  }

  setImageDimensionsOnImageProcessed(context);
}

function setImageDimensionsOnImageProcessed(context) {
  // This increment should only happen here, because this should only happen
  // once each call completes, which is sometimes asynchronous.
  context.numProcessed++;

  if(context.numProcessed === context.numImages) {
    console.assert(!context.didCallback, 'Multiple callbacks');
    context.didCallback = true;
    context.callback(context.numModified);
  }
}
