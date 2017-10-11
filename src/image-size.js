'use strict';

// Dependencies
// assert.js
// debug.js
// fetch.js
// url.js

// TODO: i notice that for documents containing the same image multiple times,
// where a fetch is needed, I trigger multiple fetches. I wonder if there is
// a better way of avoiding multiple fetches. yes, there is caching so after
// the first fetch resolves all the rest should resolve, but I am worried that
// i am sending repeated requests and I'd rather not do that. Maybe I should
// do one pass that collects the images that need to be fetched, then a pass
// over those that groups the elements by src url, then a pass over the distinct
// src urls, then a pass over the elements updating them.


// Scans the images of a document and ensures the width and height attributes
// are set. If images are missing dimensions then this fetches the dimensions
// and modifies each image element's attributes.
// Assumes that if an image has a src attribute value that is a url, that the
// url is absolute.
// @param doc {Document}
// @param timeout_ms {Number} optional, if undefined or 0 then no timeout
// @returns {Number} the number of images modified
// TODO: write tests
async function image_size_transform_document(doc, allowed_protocols,
  timeout_ms) {

  ASSERT(doc);

  if(!doc.body)
    return 0;

  const default_allowed_protocols = ['data:', 'http:', 'https:'];
  if(typeof allowed_protocols === 'undefined')
    allowed_protocols = default_allowed_protocols;

  // Duck typing assertion, I believe includes is the only functionality of
  // the parameter we care about. So if this trait is present we can infer the
  // rest and assume the parameter is usable.
  ASSERT(typeof allowed_protocols.includes === 'function');

  const image_elements = doc.body.getElementsByTagName('img');
  const derive_promises = [];
  for(const image_element of image_elements) {
    const promise = image_size_process_image_silently(image_element, allowed_protocols,
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

// TODO: deprecate once image_size_process_image no longer throws exceptions
// except for assertion failures
async function image_size_process_image_silently(image, allowed_protocols,
  timeout_ms) {
  try {
    return await image_size_process_image(image, allowed_protocols, timeout_ms);
  } catch(error) {}
}

// TODO: change to never throw exception except in rare case
async function image_size_process_image(image, allowed_protocols, timeout_ms) {
  // A template of the output produced by this function
  const result = {
    'image': image,
    'width': undefined,
    'height': undefined,
    'hint': undefined
  };

  // TODO: do not fetch if only one dimension is set. In this case just
  // assume the image is a square and set the missing dimension to the known
  // dimension. I think this is accurate most of the time. Or make it a
  // parameter, a policy parameter on whether to allow for either one or to
  // require both. No need to even modify if one is present. Instead make
  // the area algorithm assume square.
  // To do this, I need to check if one attribute is present but the other
  // is not. In that case, just copy the attribute value to the other.
  // For policy, add a infer_square boolean flag to the parameters list,
  // If true, then only require 1 to sort of exit early (after setting other).
  // If false, require both to exit early.

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

  const url_dimensions = image_size_sniff(url_object);
  if(url_dimensions) {
    result.width = url_dimensions.width;
    result.height = url_dimensions.height;
    result.hint = 'url';
    return result;
  }

  // Allow exceptions to bubble. If fetch_image succeeds without exception
  // then response is the new Image element.
  const response = await fetch_image(url_object.href, timeout_ms);

  // This was to solve a bug earlier, and am leaving it here for now because
  // I plan to change this function to use this code eventually
  /*let response;
  try {
    response = await fetch_image(url_object.href, timeout_ms);
  } catch(error) {
    console.error(error);
    return;
  }*/

  // Access the new image element information using properties, because
  // attributes are not initialized
  result.width = response.width;
  result.height = response.height;
  result.hint = 'fetch';
  return result;

}

// TODO: support "http://cdn.washingtonexaminer.biz/cache/730x420-asdf.jpg"
function image_size_sniff(url_object) {
  // Defer to fetch_image
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
  const file_name = url_path_get_file_name(path);
  if(file_name) {
    const file_name_no_extension = url_file_name_filter_extension(file_name);
    if(file_name_no_extension) {
      // TODO: parse using delim like "x" or "-", then parseInt
      // TODO: check that extension is an image extension?
      //console.debug('Inspecting file name for dimensions',
      //  file_name_no_extension);
    }
  }
}
