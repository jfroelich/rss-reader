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
  const promiseArray = new Array(imageList.length);
  for(let image of imageList) {
    const promise = updateImageDimensionsNoRaise(image, timeoutMillis);
    promiseArray.push(promise);
  }

  // Block until all images fetched
  const resultArray = await Promise.all(promiseArray);

  // Reduce resultArray into a count of true values
  let numModified = 0;
  for(let result of resultArray) {
    if(result) {
      numModified++;
    }
  }
  return numModified;
}

this.setImageDimensions = setImageDimensions;

// Allows updateImageDimensions to be used with Promise.all and avoid its
// fail-fast behavior.
async function updateImageDimensionsNoRaise(image, timeoutMillis) {
  let result = false;
  try {
    result = updateImageDimensions(image, timeoutMillis);
  } catch(error) {
    // Ignore, leave result as false
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

  const fetchPromise = fetchImage(image, urlObject.href);

  if(timeoutMillis) {
    // Race a timeoutMillis against a fetch attempt
    const promiseArray = new Array(2);
    promiseArray.push(fetchPromise);
    const timeoutPromise = rejectAfterTimeout(image, timeoutMillis);
    promiseArray.push(timeoutPromise);
    return await Promise.race(promiseArray);
  } else {

    return await fetchPromise;
  }
}

// Rejects with a time out error after a given number of ms
function rejectAfterTimeout(image, timeoutMillis) {
  return new Promise((resolve, reject) =>
    setTimeout(reject, timeoutMillis, new Error('Timed out')));
}

// Fetch an image element.
// TODO: this is not clearly named, now that this updates props
// TODO: Does a normal image request include cookie header? Minimize tracking
// @param url {String} an image url
function fetchImage(image, urlString) {
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

    proxy.onload = () => {
      image.width = proxy.width;
      image.height = proxy.height;
      resolve(true);
    };
    proxy.onerror = () => reject(
      new Error(`Failed to fetch image ${urlString}`));
  });
}

} // End file block scope
