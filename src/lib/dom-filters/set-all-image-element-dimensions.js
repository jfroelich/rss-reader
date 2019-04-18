import { Deadline, INDEFINITE } from '/src/lib/deadline.js';
import assert, { isAssertError } from '/src/lib/assert.js';
import fetchImageElement from '/src/lib/fetch-image-element.js';
import getPathExtension from '/src/lib/get-path-extension.js';

// Asynchronously tries to set width and height attributes for all images in the document.
//
// In order to minimize network activity this checks for whether the reachability filter has run
// by looking for whether the reachability filter left behind information about images.
//
// This should be run after any telemetry filter because this does network requests which expose
// presence.
//
// Assumes the document has a valid base uri.
export default function setAllImageElementDimensions(doc, timeout = INDEFINITE) {
  assert(doc instanceof Document);
  assert(timeout instanceof Deadline);

  // Concurrently traverse and possibly update each image.
  const images = doc.querySelectorAll('img');
  const promises = [];
  for (const image of images) {
    promises.push(processImage(image, timeout));
  }
  // Return a promise that resolves when all images have been processed.
  return Promise.all(promises);
}

// Attempt to set the width and height of an image element. This first uses some basic heuristics,
// and if necessary, falls back to doing a network request. If everything fails then the image is
// left as is.
async function processImage(image, timeout) {
  if (image.hasAttribute('width') && image.hasAttribute('height')) {
    return;
  }

  // Check for whether the reachability filter has run
  if (image.hasAttribute('data-reachable-width') && image.hasAttribute('data-reachable-height')) {
    image.setAttribute('width', image.getAttribute('data-reachable-width'));
    image.setAttribute('height', image.getAttribute('data-reachable-height'));
    return;
  }

  // When the image is missing width or height attributes, is inert or live, but has a style
  // attribute specifying width and height, then the width and height properties are initialized
  // through the CSS. There is no need to manually parse the css style properties because that was
  // done when the document was created. This heuristic only works for inline style, not dimensions
  // specified via a style element or a linked stylesheet.
  if (image.width > 0 && image.height > 0) {
    image.setAttribute('width', image.width);
    image.setAttribute('height', image.height);
    return;
  }

  if (!image.src) {
    return;
  }

  let url;
  try {
    // When accessing by property, this uses document.baseURI
    url = new URL(image.src);
  } catch (error) {
    return;
  }

  // Check characters in url
  const pairs = [{ w: 'w', h: 'h' }, { w: 'width', h: 'height' }];
  const exts = ['jpg', 'gif', 'svg', 'bmp', 'png'];
  if (url.protocol !== 'data:' && exts.includes(getPathExtension(url.pathname))) {
    for (const pair of pairs) {
      const width = parseInt(url.searchParams.get(pair.w), 10);
      const height = parseInt(url.searchParams.get(pair.h), 10);
      if (width > 0 && height > 0) {
        image.setAttribute('width', width);
        image.setAttribute('height', height);
        return;
      }
    }
  }

  try {
    const fetchedImage = await fetchImageElement(url, timeout);
    image.setAttribute('width', fetchedImage.width);
    image.setAttribute('height', fetchedImage.height);
  } catch (error) {
    if (isAssertError(error)) {
      throw error;
    } else {
      // Ignore
    }
  }
}
