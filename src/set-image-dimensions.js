// See license.md
'use strict';

{ // Begin file block scope

// Scans the images of a document and ensures the width and height attributes
// are set. If images are missing dimensions then this fetches the dimensions
// and modifies each image element's attributes.
// Assumes that if an image has a src attribute value that is a url, that the
// url is absolute.
// @param documentObject {Document}
// @param timeoutMillis {Number} optional, if not set or 0 then no timeout
// @returns {Number} the number of images modified
async function setImageDimensions(documentObject, timeoutMillis = 0) {
  if(!Number.isInteger(timeoutMillis) || timeoutMillis < 0) {
    throw new TypeError(`Invalid timeoutMillis parameter ${timeoutMillis}`);
  }

  // Find all images in the document.
  const imageList = documentObject.getElementsByTagName('img');

  // Fetch and update all images, concurrently
  const promises = [];
  for(let image of imageList) {
    const promise = updateImageDimensionsSilently(image, timeoutMillis);
    promises.push(promise);
  }

  // Block until all images modified
  const results = await Promise.all(promises);

  // Reduce results into a count of true values
  let numModified = 0;
  for(let result of results) {
    if(result) {
      numModified++;
    }
  }
  return numModified;
}

// Allows updateImageDimensions to be used with Promise.all and avoid its
// fail-fast behavior.
async function updateImageDimensionsSilently(image, timeoutMillis) {
  let result = false;
  const updatePromise = updateImageDimensions(image, timeoutMillis);
  try {
    result = await updatePromise;
  } catch(error) {
    // Ignore, leave result as false
    console.log('Set image dimensions error', image.getAttribute('src'), error);
  }
  return result;
}

// Updates the dimensions of a given image object. Returns true if the image
// was modified.
// @param image {HTMLImageElement}
// @param timeoutMillis {Number}
async function updateImageDimensions(image, timeoutMillis) {

  // If both attributes are set then assume no work needs to be done.
  if(image.hasAttribute('width') && image.hasAttribute('height')) {
    return false;
  }

  // Infer from inline style. Because the assumption is that the input document
  // was inert, there is no guarantee that the style props initialized the
  // width and height properties, and we know that style wasn't computed
  if(image.hasAttribute('style') && image.style.width && image.style.height) {
    image.width = image.style.width;
    image.height = image.style.height;
    return true;
  }

  const srcString = image.getAttribute('src');

  // If the image does not have a src value, then there is nothing we can do
  if(!srcString) {
    return false;
  }

  // Assume the url, if present, is absolute.
  // Verify the url is syntactically valid and parse the url's protocol
  const urlObject = new URL(srcString);

  // Only try to fetch these protocols
  // This also avoids trying to fetch a data url.
  if(urlObject.protocol !== 'http:' && urlObject.protocol !== 'https:') {
    return false;
  }

  // Allow errors to bubble
  const fetchPromise = fetchAndUpdateImage(image, urlObject.href);
  let raceOrNonRacePromise;
  if(timeoutMillis) {
    // Race a timeoutMillis against a fetch attempt
    const promises = [];
    promises.push(fetchPromise);
    const timeoutPromise = rejectAfterTimeout(image, timeoutMillis);
    promises.push(timeoutPromise);
    raceOrNonRacePromise = Promise.race(promises);
  } else {
    raceOrNonRacePromise = fetchPromise;
  }

  return await raceOrNonRacePromise;
}

// Rejects with a time out error after a given number of ms
function rejectAfterTimeout(image, timeoutMillis) {
  return new Promise((resolve, reject) =>
    setTimeout(reject, timeoutMillis, new Error('Timed out')));
}

// Fetch an image element.
// @param image {Element} an image element
// @param urlString {String} an image url
function fetchAndUpdateImage(image, urlString) {
  return new Promise((resolve, reject) => {
    // Create proxy image in document running this script
    const proxy = new Image();
    // Trigger the fetch
    proxy.src = urlString;

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
  });
}

this.setImageDimensions = setImageDimensions;

} // End file block scope
