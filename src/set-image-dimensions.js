// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

{ // Begin file block scope

// Set the width and height attributes of image elements. Calls back
// with the number of images modified.
function set_image_dimensions(document, callback) {

  console.assert(document);
  console.assert(callback);

  const context = {
    'num_processed': 0,
    'num_fetched': 0,
    'num_modified': 0,
    'num_images': 0,
    'callback': callback,
    'document': document,
    'did_callback': false
  };

  // Because we are not modifying the set of images, it makes sense to use
  // a static node list because of the minor speed boost.
  const images = document.getElementsByTagName('img');
  context.num_images = images.length;
  if(context.num_images) {
    for(let image of images) {
      process_img(context, image);
    }
  } else {
    // Ensure we still callback in the case of no images
    callback(context.num_modified);
  }
}

function process_img(context, image) {
  // Skip images with at least one dimension
  if(image.getAttribute('width') || image.getAttribute('height')) {
    on_process_img(context);
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
    let inferred_from_style = false;
    if(image.style.width) {
      image.setAttribute('width', image.style.width);
      inferred_from_style = true;
    }

    if(image.style.height) {
      image.setAttribute('height', image.style.height);
      inferred_from_style = true;
    }

    if(inferred_from_style) {
      on_process_img(context);
      return;
    }
  }

  // Skip images without a src attribute because we cannot load such images.
  // These images should probably already have been processed elsewhere and
  // probably removed, but it doesn't hurt to redundantly check here.
  const src = image.getAttribute('src');
  if(!src) {
    on_process_img(context);
    return;
  }

  // Skip images with invalid src urls
  let src_url = null;
  try {
    src_url = new URL(src);
  } catch(error) {
    console.debug('Invalid url', image.outerHTML);
    on_process_img(context);
    return;
  }

  // Skip non-http/s images. This usually means object urls.
  // Even though object urls are immediately available because the data is
  // embedded right there in the document, it looks like Chrome doesn't eagerly
  // deserialize such objects. I suppose I could load, but for now I treat
  // data: urls as not processable.
  if(src_url.protocol !== 'http:' && src_url.protocol !== 'https:') {
    on_process_img(context);
    return;
  }

  // Calling new Image creates the image in the current document context,
  // which is different than the document containing the image. The current
  // context is live, and will eagerly fetch images when the src property is
  // set. The document containing the image is inert, so setting its src would
  // not have an effect.
  const proxy_img = new Image();

  // This assignment triggers the load
  proxy_img.src = src;

  // Check if the proxy is complete. Inferrably, when setting the src property,
  // Chrome also checked whether the image was cached. In this case, the
  // dimensions are already available, so there is no need to wait for the
  // load to complete.
  if(proxy_img.complete) {
    image.setAttribute('width', proxy_img.width);
    image.setAttribute('height', proxy_img.height);
    on_process_img(context);
  } else {

    // If incomplete then bind the listeners. Because the load is async, it is
    // irrelevant that we bind the listeners after triggering the load, it
    // will still work.

    const bound_on_load = on_load.bind(proxy_img, context, image);
    proxy_img.onload = bound_on_load;
    proxy_img.onerror = bound_on_load;
  }
}

function on_load(context, image, event) {
  context.num_fetched++;
  if(event.type === 'load') {
    image.setAttribute('width', event.target.width);
    image.setAttribute('height', event.target.height);
    context.num_modified++;
  }

  on_process_img(context);
}

function on_process_img(context) {
  // This increment should only happen here, because this should only happen
  // once each call completes, which is sometimes asynchronous.
  context.num_processed++;

  if(context.num_processed === context.num_images) {
    // The did_callback logic here is a remnant of an earlier bug that has since
    // been fixed. It is left here as a reminder of the danger of incrementing
    // num_processed in the wrong place
    console.assert(!context.did_callback, 'duplicate callback');
    context.did_callback = true;
    context.callback(context.num_modified);
  }
}

this.set_image_dimensions = set_image_dimensions;

} // End file block scope
