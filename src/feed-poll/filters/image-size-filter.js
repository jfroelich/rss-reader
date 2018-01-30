import {isAllowedURL} from '/src/common/fetch-utils.js';

// TODO: use console parameter pattern to enable/disable logging
// TODO: consider somehow using document.baseURI over explicit baseURL

// Scans the images of a document and ensures the width and height attributes
// are set. If images are missing dimensions then this fetches the dimensions
// and modifies each image element's attributes.
// Assumes that if an image has a src attribute value that is a url, that the
// url is absolute.
// @param document {Document}
// @param allowedProtocols {Array} optional, if not provided then defaults
// data/http/https
// @param timeout {Number} optional, if undefined or 0 then no timeout
// @returns {Number} the number of images modified
export default async function applyImageSizeFilter(document, baseURL, timeout) {
  assert(document instanceof Document);
  assert(typeof baseURL === 'undefined' || baseURL instanceof URL);

  if (!document.body) {
    return;
  }

  const images = document.body.getElementsByTagName('img');
  if (!images.length) {
    return;
  }

  // Concurrently get dimensions for each image
  const promises = [];
  for (const image of images) {
    promises.push(getImageDimensions(image, baseURL, timeout));
  }

  // Update the DOM for images that need state change
  const results = await Promise.all(promises);
  for (const result of results) {
    if ('width' in result) {
      result.image.setAttribute('width', '' + result.width);
      result.image.setAttribute('height', '' + result.height);
      // console.debug('Set image size:', result.image.getAttribute('src'),
      //  result.image.width, result.image.height, result.reason);
    }
  }
}

async function getImageDimensions(image, baseURL, timeout) {
  if (image.hasAttribute('width') && image.hasAttribute('height')) {
    return {image: image, reason: 'has-attributes'};
  }

  let dims = getInlineStyleDimensions(image);
  if (dims) {
    return {
      image: image,
      reason: 'inline-style',
      width: dims.width,
      height: dims.height
    };
  }

  const imageSource = image.getAttribute('src');
  if (!imageSource) {
    return {image: image, reason: 'missing-src'};
    return;
  }

  // NOTE: this assumes image source url is canonical.

  // Parsing the url can throw an error. getImageDimensions should not throw
  // except in the case of a programming error.
  let sourceURL;
  try {
    sourceURL = new URL(imageSource, baseURL);
  } catch (error) {
    // If we cannot parse the url, then we cannot reliably inspect
    // the url for dimensions, nor fetch the image, so we're done.
    return {image: image, reason: 'invalid-src'};
    return;
  }

  dims = sniffDimensionsFromURL(sourceURL);
  if (dims) {
    return {
      image: image,
      reason: 'url-sniff',
      width: dims.width,
      height: dims.height
    };
  }

  // Failure to fetch should be trapped, because getImageDimensions should only
  // throw in case of a programming error, so that it can be used together with
  // Promise.all
  try {
    dims = await fetchImageElement(sourceURL, timeout);
  } catch (error) {
    return {image: image, reason: 'fetch-error'};
  }

  return {
    image: image,
    reason: 'fetch',
    width: dims.width,
    height: dims.height
  };
}

// Try and find image dimensions from the characters of its url
function sniffDimensionsFromURL(sourceURL) {
  // Ignore data urls (will be handled later by fetching)
  if (sourceURL.protocol === 'data:') {
    return;
  }

  const namedAttributePairs =
      [{width: 'w', height: 'h'}, {width: 'width', height: 'height'}];

  // Infer from url parameters
  const params = sourceURL.searchParams;
  for (const pair of namedAttributePairs) {
    const widthString = params.get(pair.width);
    if (widthString) {
      const widthInt = parseInt(widthString, 10);
      if (!isNaN(widthInt)) {
        const heightString = params.get(pair.height);
        if (heightString) {
          const heightInt = parseInt(heightString, 10);
          if (!isNaN(heightInt)) {
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
  if (fileName) {
    const partialFileName = filterExtensionFromFileName(fileName);
    if (partialFileName) {
      // not implemented
    }
  }
}

// Try and find dimensions from the style attribute of an image element. This
// does not compute style. This only considers the style attribute itself and
// not inherited styles.
// TODO: this is currently incorrect when width/height are percentage based
function getInlineStyleDimensions(element) {
  if (element.hasAttribute('style') && element.style) {
    const width = parseInt(element.style.width, 10);
    if (!isNaN(width)) {
      const height = parseInt(element.style.height, 10);
      if (!isNaN(height)) {
        return {width: width, height: height};
      }
    }
  }
}

// TODO: use the fetch API to avoid cookies. First determine if this actually
// transmits cookies. I think this should be simple to detect, just monitor the
// network tab in devtools

// Fetches an image element. Returns a promise that resolves to a fetched image
// element. Note that data uris are accepted.
// @param url {URL}
// @param timeout {Number}
// @returns {Promise}
async function fetchImageElement(url, timeout) {
  assert(
      typeof timeout === 'undefined' ||
      (Number.isInteger(timeout) && timeout >= 0));
  const fetchPromise = fetchImageElementPromise(url);
  const contestants = timeout ? [fetchPromise, sleep(timeout)] : [fetchPromise];
  const image = await Promise.race(contestants);
  assert(image, 'Fetched timed out ' + url.href);
  return image;
}

function fetchImageElementPromise(url) {
  return new Promise((resolve, reject) => {
    assert(url instanceof URL);
    const allowedProtocols = ['data:', 'http:', 'https:'];
    assert(allowedProtocols.includes(url.protocol));
    assert(isAllowedURL(url));

    // Create a proxy element within this script's document
    const proxy = new Image();
    // Set the proxy's source to trigger the fetch
    proxy.src = url.href;

    // If cached then resolve immediately
    if (proxy.complete) {
      return resolve(proxy);
    }

    proxy.onload = () => resolve(proxy);
    proxy.onerror = (event) => {

      // TODO: examine if there is a discernible error message to use rather
      // than creating a custom one
      console.dir(event);

      reject(new Error('Unknown error fetching image ' + url.href));
    };
  });
}

// Resolves to undefined after the given amount of time (in milliseconds)
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
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
  if ((index > -1) && (index + 1 < url.pathname.length)) {
    return url.pathname.substring(index + 1);
  }
}

function assert(value, message) {
  if (!value) {
    throw new Error(message || 'Assertion error');
  }
}
