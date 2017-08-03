// See license.md
'use strict';

{ // Begin file block scope

// TODO: add verbose param back in

// Scans the images of a document and ensures the width and height attributes
// are set. If images are missing dimensions then this fetches the dimensions
// and modifies each image element's attributes.
// Assumes that if an image has a src attribute value that is a url, that the
// url is absolute.
// @param doc {Document}
// @param timeout_ms {Number} optional, if undefined or 0 then no timeout
// @returns {Number} the number of images modified
async function set_img_dimensions(doc, timeout_ms) {
  if(typeof timeout_ms === 'undefined')
    timeout_ms = 0;
  if(!Number.isInteger(timeout_ms))
    throw new TypeError('timeout_ms is not an integer');
  if(timeout_ms < 0)
    throw new TypeError('timeout_ms is negative')

  if(!doc.body)
    return 0;

  const images = doc.body.getElementsByTagName('img');
  const promises = [];
  for(const image of images) {
    const promise = update_img_dims_silently(image, timeout_ms);
    promises.push(promise);
  }

  const results = await Promise.all(promises);
  let num_imgs_modified = 0;
  for(let result of results)
    if(result)
      num_imgs_modified++;
  return num_imgs_modified;
}

async function update_img_dims_silently(image, timeout_ms) {
  try {
    return await update_img_dims(image, timeout_ms);
  } catch(error) {}
}

// Updates the dimensions of a given image object. Returns true if the image
// was modified.
// @param image {HTMLImageElement}
// @param timeout_ms {Number}
async function update_img_dims(image, timeout_ms) {
  // If both attributes are set then assume no work needs to be done.
  if(image.hasAttribute('width') && image.hasAttribute('height'))
    return false;

  // Infer from inline style. Because the assumption is that the input document
  // was inert, there is no guarantee that the style props initialized the
  // width and height properties, and we know that style wasn't computed
  if(image.hasAttribute('style') && image.style.width && image.style.height) {
    image.width = image.style.width;
    image.height = image.style.height;
    return true;
  }

  const src_url_string = image.getAttribute('src');
  if(!src_url_string)
    return false;

  const src_url_object = new URL(src_url_string);
  const allowed_protocols = ['http:', 'https:'];
  if(!allowed_protocols.includes(src_url_object.protocol))
    return false;

  const fetch_promise = fetch_and_update_img(image, src_url_object.href);
  let promise;
  if(timeout_ms) {
    const promises = [];
    promises.push(fetch_promise);
    const timeout_promise = reject_after_timeout(image, timeout_ms);
    promises.push(timeout_promise);
    promise = Promise.race(promises);
  } else {
    promise = fetch_promise;
  }

  return await promise;
}

// Rejects with a time out error after a given number of ms
function reject_after_timeout(image, timeout_ms) {
  function resolver(resolve, reject) {
    const error = new Error('Timed out');
    return setTimeout(reject, timeout_ms, error);
  }
  return new Promise(resolver);
}

// Fetch an image element.
// @param image {Element} an image element
// @param urlString {String} an image url
function fetch_and_update_img(image, urlString) {
  function resolver(resolve, reject) {
    const proxy = new Image();// In document running this script
    proxy.src = urlString;// Trigger the fetch

    // Resolve immediately if cached
    if(proxy.complete) {
      image.width = proxy.width;
      image.height = proxy.height;
      resolve(true);
      return;
    }

    proxy.onload = function(event) {
      image.width = proxy.width;
      image.height = proxy.height;
      resolve(true);
    };

    // TODO: is there an error property of the event this could use?
    proxy.onerror = function(event) {
      const errorMessage = `Failed to fetch image ${urlString}`;
      const error = new Error(errorMessage);
      reject(error);
    };
  }
  return new Promise(resolver);
}

this.set_img_dimensions = set_img_dimensions;

} // End file block scope
