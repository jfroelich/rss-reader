import assert from "/src/common/assert.js";
import * as FetchUtils from "/src/utils/fetch-utils.js";
import formatString from "/src/common/format-string.js";
import * as PromiseUtils from "/src/utils/promise-utils.js";
import TimeoutError from "/src/utils/timeout-error.js";

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
  const results = await PromiseUtils.promiseEvery(promises);

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
  // NOTE: images still appear funny. I think it is because I hardcode height attribute but
  // set max-width in view, and full-width image still honors height. What really needs to happen
  // is scaling, proportionally. For now I think what I will do is filter height later, or
  // change the css.
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

  const response = await fetchImageElement(sourceURL, timeoutMs);
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

// Try and find image dimensions from the characters of its url
function sniffDimensionsFromURL(sourceURL) {
  // Ignore data urls (will be handled later by fetching)
  if(sourceURL.protocol === 'data:') {
    return;
  }

  // Infer from url parameters
  const params = sourceURL.searchParams;
  for(const pair of namedAttributePairs) {
    const widthString = params.get(pair.width);
    if(widthString) {
      const widthInt = parseInt(widthString, 10);
      if(!isNaN(widthInt)) {
        const heightString = params.get(pair.height);
        if(heightString) {
          const heightInt = parseInt(heightString, 10);
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

  // TODO: implement
  // Grab from file name (e.g. 100x100.jpg => [100,100])
  const fileName = getFileNameFromURL(sourceURL);
  if(fileName) {
    const partialFileName = filterExtensionFromFileName(fileName);
    if(partialFileName) {
      // not implemented
    }
  }
}

// Try and find dimensions from the style attribute of an image element. This does not compute
// style. This only considers the style attribute itself and not inherited styles.
// TODO: this is currently incorrect when width/height are percentage based
function getInlineStyleDimensions(element) {
  if(element.hasAttribute('style') && element.style) {
    const width = parseInt(element.style.width, 10);
    if(!isNaN(width)) {
      const height = parseInt(element.style.height, 10);
      if(!isNaN(height)) {
        return {width: width, height: height};
      }
    }
  }
}


// TODO: use the fetch API to avoid cookies. First determine if this actually transmits cookies.
// I think this should be simple to detect, just monitor the network tab in devtools

// Fetches an image element. Returns a promise that resolves to a fetched image element. Note that
// data uris are accepted.
// @param url {URL}
// @param timeoutMs {Number}
// @returns {Promise}
async function fetchImageElement(url, timeoutMs) {
  assert(url instanceof URL);
  assert(typeof timeoutMs === 'undefined' || (Number.isInteger(timeoutMs) && timeoutMs >= 0));

  if(!FetchUtils.isAllowedURL(url)) {
    const message = formatString('Refused to fetch url', url);
    throw new FetchUtils.PolicyError(message);
  }

  let timerId, timeoutPromise;

  const fetchPromise = new Promise(function fetchExec(resolve, reject) {
    const proxy = new Image();
    proxy.src = url.href;// triggers the fetch
    if(proxy.complete) {
      clearTimeout(timerId);
      resolve(proxy);
      return;
    }

    proxy.onload = function proxyOnload(event) {
      clearTimeout(timerId);
      resolve(proxy);
    };
    proxy.onerror = function proxyOnerror(event) {
      clearTimeout(timerId);
      const message = formatString('Error fetching image with url', url);
      const error = new FetchUtils.FetchError(message);
      reject(error);
    };
  });

  if(!timeoutMs) {
    return fetchPromise;
  }

  [timerId, timeoutPromise] = PromiseUtils.setTimeoutPromise(timeoutMs);
  const contestants = [fetchPromise, timeoutPromise];
  const image = await Promise.race(contestants);
  if(image) {
    clearTimeout(timerId);
  } else {
    const message = 'Timed out fetching image with url ' + url.href;
    throw new TimeoutError(message);
  }
  return fetchPromise;
}


// Returns a file name without its extension (and without the '.')
function filterExtensionFromFileName(fileName) {
  assert(typeof fileName === 'string');
  const index = fileName.lastIndexOf('.');
  return index < 0 ? fileName : fileName.substring(0, index);
}

function getFileNameFromURL(url) {
  assert(url instanceof URL);
  const index = url.pathname.lastIndexOf('/');
  if((index > -1) && (index + 1 < url.pathname.length)) {
    return url.pathname.substring(index + 1);
  }
}
