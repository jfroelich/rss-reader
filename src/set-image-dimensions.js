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

  const style_dimensions = extract_element_dimensions_from_inline_style(image);
  if(style_dimensions) {
    image.setAttribute('width', '' + style_dimensions.width);
    image.setAttribute('height', '' + style_dimensions.height);
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

  const url_dimensions = sniff_image_dimensions_from_url(src_url_object);
  if(url_dimensions) {
    image.setAttribute('width', '' + url_dimensions.width);
    image.setAttribute('height', '' + url_dimensions.height);
    if(verbose)
      console.debug('Inferred image dimensions from url', image.outerHTML);
    return true;
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

// Returns {'width': int, 'height': int} or undefined
function extract_element_dimensions_from_inline_style(element) {
  if(element.hasAttribute('style')) {
    const dimensions = {}, radix = 10;
    dimensions.width = parseInt(element.style.width, radix);
    dimensions.height = parseInt(element.style.height, radix);
    return (isNaN(dimensions.width) || isNaN(dimensions.height)) ?
      undefined : dimensions;
  }
}

function sniff_image_dimensions_from_url(url_object) {
  // Try and grab from parameters
  const params = url_object.searchParams;
  const dimensions = {}, radix = 10;
  if(params.has('w') && params.has('h')) {
    dimensions.width = parseInt(params.get('w'), radix);
    dimensions.height = parseInt(params.get('h'), radix);
    if(!isNaN(dimensions.width) && !isNaN(dimensions.height))
      return dimensions;
  }

  if(params.has('width') && params.has('height')) {
    dimensions.width = parseInt(params.get('width'), radix);
    dimensions.height = parseInt(params.get('height'), radix);
    if(!isNaN(dimensions.width) && !isNaN(dimensions.height))
      return dimensions;
  }

  // TODO: grab from file name (e.g. 100x100.jpg)
  const path = url_object.pathname;
  const file_name = extract_file_name_from_path(path);
  if(file_name) {
    const file_name_no_extension = filter_file_name_extension(file_name);
    if(file_name_no_extension) {
      // TODO: parse using delim like "x" or "-", then parseInt
      // TODO: check that extension is an image extension?
    }
  }
}

// Returns a file name without its extension
function filter_file_name_extension(file_name) {
  const index = file_name.lastIndexOf('.');
  return index < 0 ? file_name : file_name.substring(0, index);
}

function extract_file_name_from_path(path) {
  console.assert(path.charAt(0) === '/');
  const index = path.lastIndexOf('/');
  if(index > -1) {
    const index_plus_1 = index + 1;
    if(index_plus_1 < path.length)
      return path.substring(index_plus_1);
  }
  return path;
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
  function executor(resolve, reject) {
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

      // Temp, looking into whether there is an error object to grab
      // instead of creating one
      console.dir(event);

      reject(error);
    };
  }
  return new Promise(executor);
}

this.set_img_dimensions = set_img_dimensions;

} // End file block scope
