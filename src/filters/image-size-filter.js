'use strict';

// import http/fetch.js
// import url.js

// Scans the images of a document and ensures the width and height attributes
// are set. If images are missing dimensions then this fetches the dimensions
// and modifies each image element's attributes.
// Assumes that if an image has a src attribute value that is a url, that the
// url is absolute.
// @param doc {Document}
// @param timeout_ms {Number} optional, if undefined or 0 then no timeout
// @returns {Number} the number of images modified
// TODO: change to return status
async function image_size_filter(doc, allowed_protocols, timeout_ms) {
  console.assert(doc instanceof Document);

  const default_allowed_protocols = ['data:', 'http:', 'https:'];
  if(typeof allowed_protocols === 'undefined')
    allowed_protocols = default_allowed_protocols;

  // Duck typing assertion, I believe includes is the only functionality of
  // the parameter we care about. So if this trait is present we can infer the
  // rest and assume the parameter is usable.
  console.assert(typeof allowed_protocols.includes === 'function');

  // TODO: returning count isn't that important. Maybe just return status
  // code.

  let modified_image_count = 0;
  if(!doc.body)
    return modified_image_count;

  const images = doc.body.getElementsByTagName('img');
  const results = await image_size_filter_get_all_dimensions(images,
    allowed_protocols, timeout_ms);

  for(const result of results) {
    if(result) {
      result.image.setAttribute('width', '' + result.width);
      result.image.setAttribute('height', '' + result.height);
      modified_image_count++;
    }
  }
  return modified_image_count;
}

// Concurrently process each image
// TODO: inline
function image_size_filter_get_all_dimensions(images, allowed_protocols,
  timeout_ms) {
  const promises = [];
  for(const image of images) {
    const promise = image_size_filter_get_dimensions_silently(image,
      allowed_protocols, timeout_ms);
    promises.push(promise);
  }
  return Promise.all(promises);
}

async function image_size_filter_get_dimensions_silently(image,
  allowed_protocols, timeout_ms) {
  try {
    return await image_size_filter_get_dimensions(image, allowed_protocols,
      timeout_ms);
  } catch(error) {}
}

async function image_size_filter_get_dimensions(image, allowed_protocols,
  timeout_ms) {

  // A template of the output produced by this function
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

  const url_dimensions = image_size_filter_sniff(url_object);
  if(url_dimensions) {
    result.width = url_dimensions.width;
    result.height = url_dimensions.height;
    result.hint = 'url';
    return result;
  }

  // Allow exceptions to bubble
  const response = await fetch_image(url_object.href, timeout_ms);

  // Access by property, attributes are not set
  result.width = response.width;
  result.height = response.height;
  result.hint = 'fetch';
  return result;
}

function image_size_filter_sniff(url_object) {
  // data urls will not contain useful information so ignore them
  if(url_object.protocol === 'data:')
    return;

  // TODO: make the w/h and width/height search params check into a helper
  // function?

  // Try and grab from parameters
  // TODO: defer height has check and parseInt height until width processed,
  // can avoid processing in some cases

  const params = url_object.searchParams;
  const dimensions = {}, radix = 10;
  if(params.has('w') && params.has('h')) {

    dimensions.width = parseInt(params.get('w'), radix);
    dimensions.height = parseInt(params.get('h'), radix);

    if(!isNaN(dimensions.width) && !isNaN(dimensions.height)) {
      return dimensions;
    }
  }

  // Check has because the cost is less than the cost of calling parseInt
  // (untested assumption)

  // TODO: defer height has check and parseInt height until width processed,
  // can avoid processing in some cases

  if(params.has('width') && params.has('height')) {
    dimensions.width = parseInt(params.get('width'), radix);
    dimensions.height = parseInt(params.get('height'), radix);

    if(!isNaN(dimensions.width) && !isNaN(dimensions.height)) {
      return dimensions;
    }
  }

  // TODO: support the following url, s1200 is the feature, s being short for
  // size, and here size meaning width, this is a 1200px width image
  // https://media.npr.org/...9fb33b1-s1200.jpg

  // TODO: make a helper function
  // Grab from file name (e.g. 100x100.jpg => [100,100])
  const path = url_object.pathname;
  const file_name = url_path_get_file_name(path);
  if(file_name) {
    const file_name_no_extension = url_file_name_filter_extension(file_name);
    if(file_name_no_extension) {
      // not implemented
    }
  }
}
