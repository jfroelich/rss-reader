'use strict';

// import base/promises.js
// import net/fetch.js
// import net/url-utils.js
// import dom.js

// Scans the images of a document and ensures the width and height attributes
// are set. If images are missing dimensions then this fetches the dimensions
// and modifies each image element's attributes.
// Assumes that if an image has a src attribute value that is a url, that the
// url is absolute.
// @param doc {Document}
// @param timeoutMs {Number} optional, if undefined or 0 then no timeout
// @returns {Number} the number of images modified
async function imageSizeFilter(doc, allowedProtocols, timeoutMs) {
  console.assert(doc instanceof Document);

  const DEFAULT_ALLOWED_PROTOCOLS = ['data:', 'http:', 'https:'];
  if(typeof allowedProtocols === 'undefined') {
    allowedProtocols = DEFAULT_ALLOWED_PROTOCOLS;
  }

  // Duck typing assertion
  console.assert(typeof allowedProtocols.includes === 'function');

  if(!doc.body) {
    return RDR_OK;
  }

  // Get all images
  const images = doc.body.getElementsByTagName('img');

  // Concurrently process each image
  const promises = [];
  for(const image of images) {
    const promise = imageSizeFilterGetDimensions(image, allowedProtocols,
      timeoutMs);
    promises.push(promise);
  }
  const results = await promiseEvery(promises);

  for(const result of results) {
    if(result) {
      result.image.setAttribute('width', '' + result.width);
      result.image.setAttribute('height', '' + result.height);
    }
  }
  return RDR_OK;
}

async function imageSizeFilterGetDimensions(image, allowedProtocols,
  timeoutMs) {

  // A template of the output produced by this function
  const result = {
    'image': image,
    'width': undefined,
    'height': undefined,
    'hint': undefined
  };

  if(image.hasAttribute('width') && image.hasAttribute('height')) {
    return;
  }

  const styleDimensions = domGetDimensions(image);
  if(styleDimensions) {
    result.width = styleDimensions.width;
    result.height = styleDimensions.height;
    result.hint = 'style';
    return result;
  }

  const imageSource = image.getAttribute('src');
  if(!imageSource) {
    return;
  }

  const sourceURL = new URL(imageSource);
  if(!allowedProtocols.includes(sourceURL.protocol)) {
    return;
  }

  const urlDimensions = imageSizeFilterSniff(sourceURL);
  if(urlDimensions) {
    result.width = urlDimensions.width;
    result.height = urlDimensions.height;
    result.hint = 'url';
    return result;
  }

  // Allow exceptions to bubble
  const response = await fetchImage(sourceURL.href, timeoutMs);

  // Access by property, attributes are not set
  result.width = response.width;
  result.height = response.height;
  result.hint = 'fetch';
  return result;
}

function imageSizeFilterSniff(sourceURL) {
  // data urls will not contain useful information so ignore them
  if(sourceURL.protocol === 'data:') {
    return;
  }

  // TODO: make the w/h and width/height search params check into a helper
  // function?

  // Try and grab from parameters
  // TODO: defer height has check and parseInt height until width processed,
  // can avoid processing in some cases

  const params = sourceURL.searchParams;
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
  const path = sourceURL.pathname;
  const fileName = URLUtils.getFileNameFromPath(path);
  if(fileName) {
    const partialFileName = URLUtils.filterExtensionFromFileName(fileName);
    if(partialFileName) {
      // not implemented
    }
  }
}
