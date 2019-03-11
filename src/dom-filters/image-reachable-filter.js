import {assert, AssertionError} from '/src/assert.js';
import {Deadline, INDEFINITE} from '/src/deadline.js';
import {fetch_image_element} from '/src/dom-filters/fetch-image-element.js';
import {NetworkError} from '/src/net/net.js';

// TODO: explicit support for picture/source and srcset, because this filter
// should be naive with respect to what other filters have fun, and because it
// should be associative, meaning that it does not matter whether the other
// filters have run or will run.

// Asynchronously filters unreachable images from the document. An image is
// unreachable if attempting to fetch the image's url fails with an error like a
// 404. If an image is unreachable its element is removed from the document.
//
// This should generally be run after any kind of telemetry filter, because it
// does involve network requests.
//
// This should generally be run before the filter that sets image dimensions,
// because those requests will be redundant with the network requests made by
// this filter. While there may be caching at the network layer, we do not want
// to rely on that. Therefore this caches the image dimensions in the image
// element as attributes so that later filters can avoid the network.
//
// This makes use of the image element's src property, which relies on the
// document having a valid baseURI.
export function image_reachable_filter(doc, timeout = INDEFINITE) {
  assert(doc instanceof Document);
  assert(timeout instanceof Deadline);

  const promises = [];
  const images = doc.querySelectorAll('img');
  for (const image of images) {
    promises.push(process_image(image, timeout));
  }

  return Promise.all(promises);
}

// Given an image element, inspect its src value and try to fetch the
// corresponding resource. If successful, stash the width and height in the
// element for later. If unsuccessful, remove the image.
async function process_image(image, timeout) {
  let url;
  try {
    url = new URL(image.src);
  } catch (error) {
    // If an image has an invalid url, then it is unreachable. However, this
    // filter only concerns itself with network errors, not html issues. Some
    // other filter can deal with this situation better.

    // TEMP: this is newer functionality, and I am witnessing a substantial
    // amount of missing images, so for now I am logging this situation.
    console.debug('Ignoring image', image.outerHTML);

    return;
  }

  let fetched_image;
  try {
    fetched_image = await fetch_image_element(url, timeout);
  } catch (error) {
    // fetch_image_element can raise assertion errors that we want to be careful
    // not to surpress.
    if (error instanceof AssertionError) {
      throw error;
    }

    // Distinguish between failure due to lack of internet, and a failure due
    // to a resource not being found. When disconnected, everything is
    // unreachable, and we would incorrectly determine all images are bad.
    if (error instanceof NetworkError) {
      return;
    }

    // TEMP: just monitoring this filter for a bit
    console.debug('Unreachable image', error);

    // We encountered some other kind of error, such as a timeout error, or
    // a 404, so conclude the image is unreachable.
    image.remove();
    return;
  }

  // Stash information in the element so that later filters potentially avoid
  // making network requests.
  image.setAttribute('data-reachable-width', fetched_image.width);
  image.setAttribute('data-reachable-height', fetched_image.height);
}

// Returns the url of the image as a URL. This may be the src attribute value,
// an associated source element href value from an enclosing picture element,
// or one of the srcset descriptors (selected by first, not best). Throws an
// error if the url is malformed. Returns undefined if nothing was found.
function find_image_source(image) {
  // TODO: implement
}
