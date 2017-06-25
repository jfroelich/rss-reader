// See license.md

'use strict';


// TODO: refactor into an independent library. Only export a single global
// TODO: use better variable names
// TODO: avoid use of Map and such

// Scans the images of a document and ensures the width and height attributes
// are set. If images are missing dimensions then this fetches the dimensions
// and modifies each image element's attributes.
// @param doc {Document}
// @param timeout {Number} optional, if not set or 0 then no timeout, millis
// @returns {Number} the number of images modified
async function jrImageDimsTransformDocument(doc, timeout = 0) {
  if(!Number.isInteger(timeout) || timeout < 0) {
    throw new TypeError(`Invalid timeout parameter ${timeout}`);
  }

  // TODO: currently this blocks until all fetched, and then does DOM
  // modification. If the browser supports concurrent DOM modification, it would
  // seem better to also update the DOM concurrently, and only block at the
  // very end of the function prior to returning.


  // Find and fetch all images concurrently
  const images = doc.getElementsByTagName('img');
  const proms = Array.prototype.map.call(images,
    (image) => jrImageDimsGetImageDimensions(image, timeout));
  let results = await Promise.all(proms);

  // Ignore images not fetched
  results = results.filter((r) => r);

  // Update attributes of image elements for fetched images
  for(let {image, width, height} of results) {
    image.setAttribute('width', width);
    image.setAttribute('height', height);
  }
  return results.length;
}

// Retrieves the dimensions for a given image object
// @param image {HTMLImageElement}
// @param timeout {Number}
async function jrImageDimsGetImageDimensions(image, timeout) {
  if(image.hasAttribute('width') && image.hasAttribute('height')) {
    return;
  }

  // Infer from inline style. Because the assumption is that the input doc
  // was inert, there is no guarantee that the style props initialized the
  // width and height properties, and we know that style wasn't computed
  if(image.hasAttribute('style') && image.style.width && image.style.height) {
    return {'image': image, 'w': image.style.width,'h': image.style.height};
  }

  // Even though sourceless images are filtered elsewhere, this cannot make
  // any assumptions about that. So this is redundant for the sake of
  // independence.
  const src = image.getAttribute('src');
  if(!src) {
    return;
  }

  // Verify the url is syntactically valid and parse the url's protocol
  let url;
  try {
    url = new URL(src);
  } catch(error) {
    return;
  }

  // Only try to fetch these protocols
  if(url.protocol !== 'http:' && url.protocol !== 'https:') {
    return;
  }

  // Race a timeout against a fetch attempt
  const promises = [jrImageDimsFetchImage(url.href)];
  if(timeout) {
    promises.push(jrImageDimsRejectAfterTimeout(timeout));
  }

  let proxy;
  try {
    proxy = await Promise.race(promises);
    return {'image': image, 'w': proxy.width, 'h': proxy.height};
  } catch(error) {
    // Fall through to implied return undefined
  }
}

// Rejects with a time out error after a given number of ms
function jrImageDimsRejectAfterTimeout(timeoutMillis) {
  return new Promise((resolve, reject) =>
    setTimeout(reject, timeoutMillis, new Error('Timed out')));
}

// Fetch an image element.
// TODO: Does a normal image request include cookie header? Minimize tracking
// @param url {String} an image url
function jrImageDimsFetchImage(url) {
  return new Promise((resolve, reject) => {
    // Create proxy image in document running this script
    const image = new Image();
    // Trigger the fetch
    image.src = url;
    // Resolve immediately if cached
    if(image.complete) {
      resolve(image);
      return;
    }

    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load image ${url}`));
  });
}
