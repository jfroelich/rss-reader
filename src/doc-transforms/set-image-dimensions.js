(function(exports) {
'use strict';

// Scans the images of a document and ensures the width and height attributes
// are set. If images are missing dimensions then this fetches the dimensions
// and modifies each image element's attributes.
// Assumes that if an image has a src attribute value that is a url, that the
// url is absolute.
// @param doc {Document}
// @param timeout_ms {Number} optional, if undefined or 0 then no timeout
// @returns {Number} the number of images modified
async function set_img_dimensions(doc, allowed_protocols, timeout_ms) {
  if(!doc.body)
    return 0;

  const default_allowed_protocols = ['data:', 'http:', 'https:'];
  if(typeof allowed_protocols === 'undefined')
    allowed_protocols = default_allowed_protocols;
  ASSERT(typeof allowed_protocols.includes === 'function');

  if(typeof timeout_ms === 'undefined')
    timeout_ms = 0;
  ASSERT(Number.isInteger(timeout_ms));
  ASSERT(timeout_ms >= 0);

  const image_elements = doc.body.getElementsByTagName('img');
  const derive_promises = [];
  for(const image_element of image_elements) {
    const promise = derive_img_dims_silently(image_element, allowed_protocols,
      timeout_ms);
    derive_promises.push(promise);
  }

  const results = await Promise.all(derive_promises);
  let modified_image_count = 0;
  for(const result of results) {
    if(result) {
      result.image.setAttribute('width', '' + result.width);
      result.image.setAttribute('height', '' + result.height);
      modified_image_count++;
    }
  }
  return modified_image_count;
}

async function derive_img_dims_silently(image, allowed_protocols, timeout_ms) {
  try {
    return await derive_img_dims(image, allowed_protocols, timeout_ms);
  } catch(error) {}
}

async function derive_img_dims(image, allowed_protocols, timeout_ms) {
  const result = {
    'image': image,
    'width': undefined,
    'height': undefined,
    'hint': undefined
  };

  if(image.hasAttribute('width') && image.hasAttribute('height'))
    return;

  const style_dimensions = element_get_dimensions(image);
  if(style_dimensions) {
    result.width = style_dimensions.width;
    result.height = style_dimensions.height;
    result.hint = 'style';
    return result;
  }

  const url_string = image.getAttribute('src');
  if(!url_string)
    return;

  const url_object = new URL(url_string);
  if(!allowed_protocols.includes(url_object.protocol))
    return;

  const url_dimensions = sniff_image_dimensions_from_url(url_object);
  if(url_dimensions) {
    result.width = url_dimensions.width;
    result.height = url_dimensions.height;
    result.hint = 'url';
    return result;
  }

  const fetched_dimensions = await fetch_image_dimensions_with_timeout(
    url_object, timeout_ms);
  if(fetched_dimensions) {
    result.width = fetched_dimensions.width;
    result.height = fetched_dimensions.height;
    result.hint = 'fetch';
    return result;
  }
}

function sniff_image_dimensions_from_url(url_object) {
  if(url_object.protocol === 'data:')
    return;

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

  // TODO: this is currently difficult to test, and would be more appropriate
  // to develop by using a test instead of poll. So this is kind of blocked
  // on actually writing proper tests.
  // TODO: grab from file name (e.g. 100x100.jpg)
  const path = url_object.pathname;
  const file_name = extract_file_name_from_path(path);
  if(file_name) {
    const file_name_no_extension = filter_file_name_extension(file_name);
    if(file_name_no_extension) {
      // TODO: parse using delim like "x" or "-", then parseInt
      // TODO: check that extension is an image extension?
      //console.debug('Inspecting file name for dimensions',
      //  file_name_no_extension);
    }
  }
}

// Returns a file name without its extension
function filter_file_name_extension(file_name) {
  const index = file_name.lastIndexOf('.');
  return index < 0 ? file_name : file_name.substring(0, index);
}

function extract_file_name_from_path(path) {
  console.assert(path.charAt(0) === '/', 'invalid path: ' + path);
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

function fetch_image_dimensions_with_timeout(url_object, timeout_ms) {
  const fetch_promise = fetch_image_dimensions(url_object);
  if(timeout_ms) {
    const error_msg = 'Timed out loading image ' + url_object.href;
    const timeout_promise = reject_after_timeout(timeout_ms, error_msg);
    const promises = [fetch_promise, timeout_promise];
    return Promise.race(promises);
  } else {
    return fetch_promise;
  }
}

// TODO: this should be in fetch lib
function fetch_image_dimensions(url_object) {
  function executor(resolve, reject) {
    const proxy = new Image();// In document running this script
    proxy.src = url_object.href;// Trigger the fetch

    // Resolve immediately if cached
    if(proxy.complete) {
      resolve({'width': proxy.width, 'height': proxy.height});
      return;
    }

    proxy.onload = function(event) {
      resolve({'width': proxy.width, 'height': proxy.height});
    };

    proxy.onerror = function(event) {
      // There is no useful error object in the event, so construct our own
      const error_message = `Failed to fetch ${url_object.href}`;
      const error = new Error(error_message);
      reject(error);
    };
  }
  return new Promise(executor);
}

exports.set_img_dimensions = set_img_dimensions;

}(this));

/*

# About

Ensures all images have width and height attributes

# TODO

* Change to not fetch if only one dimension is set. In this case just assume the
image is a square and set the missing dimension to the known dimension. I think
this is accurate most of the time. Or make it a parameter, a policy parameter
on whether to allow for either one or to require both. Also no need to even
modify if one is present. Instead make the area algorithm assume square.
* fetch img may need to use the fetch library internally, because
I want to avoid sending cookies and such.
* Undecided on whether fetch should accept a doc parameter so
that where the image element is created is configurable. Maybe it is a security
concern if loading an image is somehow XSS vulnerable? Maybe it is not safe to
assume that new Image() works in all contexts?
* This needs testing library that isolates specific branches of the code and
asserts that each section works as expected.
* Rather than use a custom error message when failing to fetch an image, look
into whether there is some error property of the image or the event that can be
used instead.
* Finish the infer from filename stuff

# Notes on possible fetch image issue

See https://stackoverflow.com/questions/4776670 . Apparently the proper
convention is to always trigger the fetch after attaching the handlers?

# Notes on data uris

fetch works with data uris. Can use the same proxy technique as fetch to
get the dimensions.
*/
