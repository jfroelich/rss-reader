import assert from "/src/assert/assert.js";
import fetchImageElement from "/src/fetch/fetch-image-element.js";
import parseInt10 from "/src/utils/parse-int-10.js";
import promiseEvery from "/src/promise/every.js";
import {filterExtensionFromFileName, getFileNameFromURL} from "/src/url/url.js";

// Module related to image size attributes

const DEBUG = false;
function log(...args) {
  if(DEBUG) {
    console.log(...args);
  }
}


const DEFAULT_ALLOWED_PROTOCOLS = ['data:', 'http:', 'https:'];

// Scans the images of a document and ensures the width and height attributes
// are set. If images are missing dimensions then this fetches the dimensions
// and modifies each image element's attributes.
// Assumes that if an image has a src attribute value that is a url, that the
// url is absolute.
// @param doc {Document}
// @param allowedProtocols
// @param timeoutMs {Number} optional, if undefined or 0 then no timeout
// @returns {Number} the number of images modified
export default async function filterDocument(doc, allowedProtocols, timeoutMs) {
  assert(doc instanceof Document);

  if(typeof allowedProtocols === 'undefined') {
    allowedProtocols = DEFAULT_ALLOWED_PROTOCOLS;
  }

  // Duck typing assertion
  assert(typeof allowedProtocols.includes === 'function');

  if(!doc.body) {
    return;
  }

  // Get all images
  const images = doc.body.getElementsByTagName('img');
  if(!images.length) {
    return;
  }

  // Concurrently process each image
  const promises = [];
  for(const image of images) {
    promises.push(getImageDimensions(image, allowedProtocols, timeoutMs));
  }
  const results = await promiseEvery(promises);

  for(const result of results) {
    if(result) {
      result.image.setAttribute('width', '' + result.width);
      result.image.setAttribute('height', '' + result.height);
      log(result.image.outerHTML);
    }
  }
}

async function getImageDimensions(image, allowedProtocols, timeoutMs) {

  const result = {
    image: image,
    width: undefined,
    height: undefined,
    reason: undefined
  };

  // If both attributes are present, then immediately resolve with undefined to indicate no
  // change should be made to the image.
  if(image.hasAttribute('width') && image.hasAttribute('height')) {
    return;
  }


  // Square inference
  // If the image has width, then we know it does not have height due to the above condition.
  // To improve performance, infer that the image is a square

  // NOTE: I've disabled because it is leading to funny looking images. Not sure if that
  // is because I no longer filter width/height from attributes later or because of this
  /*if(image.hasAttribute('width')) {
    // Keep width as width. We know image.width will be set because the parser set the property
    // given the presence of the attribute
    result.width = image.width;
    // Set height to width
    result.height = image.width;
    result.reason = 'height-inferred-from-width';
    return result;
  }*/


  // Square inference
  // Do the same thing for an image that just has height. We still have to check, because the image
  // could have neither.
  // NOTE: temporarily disabled, see above note
  /*if(image.hasAttribute('height')) {
    // Infer width from height
    result.width = image.height;
    result.height = image.height;
    result.reason = 'width-inferred-from-height';
    return result;
  }*/

  const styleDimensions = getInlineStyleDimensions(image);
  if(styleDimensions) {
    result.width = styleDimensions.width;
    result.height = styleDimensions.height;
    result.reason = 'style';
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

  const urlDimensions = sniffDimensionsFromURL(sourceURL);
  if(urlDimensions) {
    result.width = urlDimensions.width;
    result.height = urlDimensions.height;
    result.reason = 'url';
    return result;
  }

  const response = await fetchImageElement(sourceURL.href, timeoutMs);
  log('Found dimensions from fetch', image.outerHTML, response.width, response.height);
  result.width = response.width;
  result.height = response.height;
  result.reason = 'fetch';
  return result;
}

const namedAttributePairs = [
  {width: 'w', height: 'h'},
  {width: 'width', height: 'height'}
];

// This only returns a useful object if both dimensions are set
function sniffDimensionsFromURL(sourceURL) {
  // Ignore data urls (will be handled later by fetching)
  if(sourceURL.protocol === 'data:') {
    return;
  }

  // Infer from url parameters
  const params = sourceURL.searchParams;
  for(const pair of namedAttributePairs) {
    const widthString = params.get(pair.width);
    if(width) {
      const widthInt = parseInt10(widthString);
      if(!isNaN(widthInt)) {
        const heightString = params.get(pair.height);
        if(heightString) {
          const heightInt = parseInt10(heightString);
          if(!isNaN(heightInt)) {
            const dimensions = {};
            dimensions.width = widthInt;
            dimensions.height = heightInt;
            return dimensions;
          }
        }
      }
    }
  }

  // TODO: make a helper function?
  // Grab from file name (e.g. 100x100.jpg => [100,100])
  const fileName = getFileNameFromURL(sourceURL);
  if(fileName) {
    const partialFileName = filterExtensionFromFileName(fileName);
    if(partialFileName) {
      // not implemented
    }
  }
}

// TODO: support all value formats
function getInlineStyleDimensions(element) {
  if(element.hasAttribute('style') && element.style) {
    const width = parseInt10(element.style.width);
    if(!isNaN(width)) {
      const height = parseInt10(element.style.height);
      if(!isNaN(height)) {
        return {width: width, height: height};
      }
    }
  }
}
