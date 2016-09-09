// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

{ // Begin file block scope

// Set the width and height attributes of image elements. Calls back
// with the number of images modified.
function setImageDimensions(doc, callback) {

  console.assert(doc);
  console.assert(callback);

  const context = {
    'numImagesProcessed': 0,
    'numImagesFetched': 0,
    'numImagesModified': 0,
    'numImages': 0,
    'callback': callback,
    'doc': doc,
    'didCallback': false
  };

  // Because we are not modifying the set of images, it makes sense to use
  // a static node list because of the minor speed boost.
  const images = doc.getElementsByTagName('img');
  context.numImages = images.length;
  if(context.numImages) {
    for(let image of images) {
      processImage(context, image);
    }
  } else {
    // Ensure we still callback in the case of no images
    callback(context.numImagesModified);
  }
}

function processImage(context, image) {
  // Skip images with at least one dimension
  if(image.getAttribute('width') || image.getAttribute('height')) {
    onProcessImage(context);
    return;
  }

  // Check if the dimensions are available from an inline style attribute
  // This will trigger style computation, which is pretty damn slow, but that
  // shouldn't matter too much given that this is async. Note that accessing
  // the style property only looks at the inline style, as desired, which is
  // different than getComputedStyle, which looks at the inherited properties
  // too. Also note that image.style.width yields a string, such as "100%" or
  // "50px", and this is the value set for the attribute.
  if(image.hasAttribute('style')) {
    // An image could have one dimension specified but not the other, or both,
    // or neither. So check against the dimensions individually. If we were
    // able to set either one, then consider the image processed.
    let didInferFromStyle = false;
    if(image.style.width) {
      image.setAttribute('width', image.style.width);
      didInferFromStyle = true;
    }

    if(image.style.height) {
      image.setAttribute('height', image.style.height);
      didInferFromStyle = true;
    }

    if(didInferFromStyle) {
      onProcessImage(context);
      return;
    }
  }

  // Skip images without a src attribute because we cannot load such images.
  // These images should probably already have been processed elsewhere and
  // probably removed, but it doesn't hurt to redundantly check here.
  const src = image.getAttribute('src');
  if(!src) {
    onProcessImage(context);
    return;
  }

  // Skip images with invalid src urls
  let srcURL = null;
  try {
    srcURL = new URL(src);
  } catch(error) {
    console.debug('Invalid url', image.outerHTML);
    onProcessImage(context);
    return;
  }

  // Skip non-http/s images. This usually means object urls.
  // Even though object urls are immediately available because the data is
  // embedded right there in the document, it looks like Chrome doesn't eagerly
  // deserialize such objects. I suppose I could load, but for now I treat
  // data: urls as not processable.
  if(srcURL.protocol !== 'http:' && srcURL.protocol !== 'https:') {
    onProcessImage(context);
    return;
  }

  // Calling new Image creates the image in the current document context,
  // which is different than the document containing the image. The current
  // context is live, and will eagerly fetch images when the src property is
  // set. The document containing the image is inert, so setting its src would
  // not have an effect.
  const proxyImage = new Image();

  // This assignment triggers the load
  proxyImage.src = src;

  // Check if the proxy is complete. Inferrably, when setting the src property,
  // Chrome also checked whether the image was cached. In this case, the
  // dimensions are already available, so there is no need to wait for the
  // load to complete.
  if(proxyImage.complete) {
    image.setAttribute('width', proxyImage.width);
    image.setAttribute('height', proxyImage.height);
    onProcessImage(context);
  } else {

    // If incomplete then bind the listeners. Because the load is async, it is
    // irrelevant that we bind the listeners after triggering the load, it
    // will still work.

    // TODO: go back to using two separate listener functions, I think it is
    // clearer

    const boundOnLoad = proxyImageOnLoad.bind(proxyImage, context, image);
    proxyImage.onload = boundOnLoad;
    proxyImage.onerror = boundOnLoad;
  }
}

function proxyImageOnLoad(context, image, event) {
  context.numImagesFetched++;
  if(event.type === 'load') {
    image.setAttribute('width', event.target.width);
    image.setAttribute('height', event.target.height);
    context.numImagesModified++;
  }

  onProcessImage(context);
}

function onProcessImage(context) {
  // This increment should only happen here, because this should only happen
  // once each call completes, which is sometimes asynchronous.
  context.numImagesProcessed++;

  if(context.numImagesProcessed === context.numImages) {
    // The didCallback logic here is a remnant of an earlier bug that has since
    // been fixed. It is left here as a reminder of the danger of incrementing
    // numImagesProcessed in the wrong place
    console.assert(!context.didCallback, 'duplicate callback');
    context.didCallback = true;
    context.callback(context.numImagesModified);
  }
}

this.setImageDimensions = setImageDimensions;

} // End file block scope
