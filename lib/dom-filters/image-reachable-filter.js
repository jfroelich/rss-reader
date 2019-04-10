import assert from '/lib/assert.js';
import {is_assert_error} from '/lib/assert.js';
import {NetworkError} from '/lib/better-fetch.js';
import {Deadline, INDEFINITE} from '/lib/deadline.js';
import fetch_image_element from '/lib/fetch-image-element.js';
import * as srcset_utils from '/lib/srcset-utils.js';

// Asynchronously filters unreachable images from the document. An image is
// unreachable if attempting to fetch the image's url fails with an error like a
// 404. If an image is unreachable its element is removed from the document.
//
// This should generally be run after any kind of telemetry filter, because it
// naively sends network requests that would defeat the purpose of filtering
// telemetry.
//
// This should generally be run before the filter that sets image dimensions,
// because those requests will be redundant with the network requests made by
// this filter. While there may be caching at the network layer, we do not want
// to rely on that. Therefore this caches the image dimensions in the image
// element as attributes so that later filters can avoid the network.
//
// This filter assumes the document has a valid baseURI.
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
    url = find_image_source(image);
  } catch (error) {
    // If an image has an invalid url, then it is unreachable. However, this
    // filter only concerns itself with network errors, not html issues.
    return;
  }

  // If we failed to find a source url for the image, just skip the image.
  if (!url) {
    // TEMP: just monitoring new functionality for a bit
    console.debug('Ignoring image missing src', image.outerHTML);

    return;
  }

  let fetched_image;
  try {
    fetched_image = await fetch_image_element(url, timeout);
  } catch (error) {
    // fetch_image_element can raise assertion errors that we want to be careful
    // not to surpress.
    if (is_assert_error(error)) {
      throw error;
    }

    // Distinguish between failure due to lack of internet, and a failure due
    // to a resource not being found.
    if (error instanceof NetworkError) {
      return;
    }

    // TEMP: just monitoring this filter for a bit
    console.warn(error);

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
  if (image.hasAttribute('src')) {
    return new URL(image.src);
  }

  const picture = image.parentNode.closest('picture');
  if (picture) {
    const sources = picture.querySelectorAll('source');
    for (const source of sources) {
      if (source.hasAttribute('src')) {
        return new URL(source.src);
      }

      if (source.hasAttribute('srcset')) {
        return select_srcset_source(source);
      }
    }
  }

  return select_srcset_source(image);
}

function select_srcset_source(element) {
  const value = element.getAttribute('srcset');
  if (!value) {
    return;
  }

  const base_url_string = element.ownerDocument.baseURI;
  const descriptors = srcset_utils.parse(value);
  for (const descriptor of descriptors) {
    if (descriptor.url) {
      return new URL(descriptor.url, base_url_string);
    }
  }
}
