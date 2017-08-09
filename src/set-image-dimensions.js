// See license.md
'use strict';

{ // Begin file block scope

// Scans the images of a document and ensures the width and height attributes
// are set. If images are missing dimensions then this fetches the dimensions
// and modifies each image element's attributes.
// Assumes that if an image has a src attribute value that is a url, that the
// url is absolute.
// @param doc {Document}
// @param timeout_ms {Number} optional, if undefined or 0 then no timeout
// @returns {Number} the number of images modified
async function set_img_dimensions(doc, allowed_protocols, timeout_ms, verbose) {
  const default_allowed_protocols = ['data:', 'http:', 'https:'];

  if(typeof allowed_protocols === 'undefined')
    allowed_protocols = default_allowed_protocols;
  else if(typeof allowed_protocols.includes !== 'function')
    throw new TypeError('allowed_protocols.includes is not a function');

  if(typeof timeout_ms === 'undefined')
    timeout_ms = 0;
  else if(!Number.isInteger(timeout_ms))
    throw new TypeError('timeout_ms is not an integer');
  else if(timeout_ms < 0)
    throw new TypeError('timeout_ms is negative')

  if(verbose)
    console.debug('Starting set_img_dimensions...');

  if(!doc.body) {
    if(verbose)
      console.debug(
        'Cannot modify image dimensions of document missing body element');
    return 0;
  }

  // Because this does not remove images while iterating, use
  // getElementsByTagName for better performance
  const images = doc.body.getElementsByTagName('img');
  const promises = [];
  for(const image of images) {
    const promise = update_img_dims_silently(image, allowed_protocols,
      timeout_ms, verbose);
    promises.push(promise);
  }

  const results = await Promise.all(promises);
  let num_imgs_modified = 0;
  for(let result of results)
    if(result)
      num_imgs_modified++;

  if(verbose)
    console.debug('Modified %s images in document', num_imgs_modified);

  return num_imgs_modified;
}

async function update_img_dims_silently(image, allowed_protocols, timeout_ms,
  verbose) {
  try {
    return await update_img_dims(image, allowed_protocols, timeout_ms, verbose);
  } catch(error) {
    if(verbose)
      console.debug(error);
  }
}

// Updates the dimensions of a given image object. Returns true if the image
// was modified.
async function update_img_dims(image, allowed_protocols, timeout_ms, verbose) {
  // If both attributes are set then assume no work needs to be done.
  if(image.hasAttribute('width') && image.hasAttribute('height'))
    return false;

  // TODO: when accessing style prop it returns units. Strip the units from
  // the attribute value. E.g. instead of 100px, set to 100.

  // Infer from inline style. Because the assumption is that the input document
  // was inert, there is no guarantee that the style props initialized the
  // width and height properties, and we know that style wasn't computed
  if(image.hasAttribute('style') && image.style.width && image.style.height) {
    image.setAttribute('width', '' + image.style.width);
    image.setAttribute('height', '' + image.style.height);
    if(verbose)
      console.debug('Inferred image dimensions from style', image.outerHTML);
    return true;
  }

  const src_url_string = image.getAttribute('src');
  if(!src_url_string)
    return false;

  const src_url_object = new URL(src_url_string);
  if(!allowed_protocols.includes(src_url_object.protocol)) {
    if(verbose)
      console.debug('Cannot set image dimensions due to src url protocol',
        image.outerHTML);
    return false;
  }

  const fetch_promise = fetch_and_update_img(image, src_url_object.href,
    verbose);
  let promise;
  if(timeout_ms) {
    const error_msg = 'Timed out fetching image ' + image.getAttribute('src');
    const timeout_promise = reject_after_timeout(timeout_ms, error_msg);
    const promises = [fetch_promise, timeout_promise];
    promise = Promise.race(promises);
  } else {
    promise = fetch_promise;
  }

  return await promise;
}


function reject_after_timeout(timeout_ms, error_msg) {
  function resolver(resolve, reject) {
    error_msg = error_msg || 'Operation timed out';
    const error = new Error(error_msg);
    return setTimeout(reject, timeout_ms, error);
  }
  return new Promise(resolver);
}

function fetch_and_update_img(image, url_string, verbose) {
  function resolver(resolve, reject) {
    const proxy = new Image();// In document running this script
    proxy.src = url_string;// Trigger the fetch

    // Resolve immediately if cached
    if(proxy.complete) {
      image.setAttribute('width', '' + proxy.width);
      image.setAttribute('height', '' + proxy.height);
      if(verbose)
        console.debug('Set image size from cache', image.outerHTML);
      resolve(true);

      // Avoid binding listeners and also avoid the second resolve call.
      return;
    }

    proxy.onload = function(event) {
      image.setAttribute('width', '' + proxy.width);
      image.setAttribute('height', '' + proxy.height);
      //if(verbose)
      //  console.debug('Set image size from fetch', image.outerHTML);
      resolve(true);
    };

    proxy.onerror = function(event) {
      const error_msg = `Failed to fetch image ${url_string}`;
      const error = new Error(error_msg);
      reject(error);
    };
  }
  return new Promise(resolver);
}

this.set_img_dimensions = set_img_dimensions;

} // End file block scope
