import {assert, AssertionError} from '/src/lib/assert.js';
import {Deadline, INDEFINITE} from '/src/lib/deadline.js';
import * as document_utils from '/src/lib/document-utils.js';
import {fetch_image_element} from '/src/lib/fetch-image-element.js';
import * as url_utils from '/src/lib/url-utils.js';

// Asynchronously tries to set width/height attributes for all images.
//
// Knowing the dimensions of an image is helpful, for example, when determing
// which content in the document is boilerplate, or whether an image seems like
// it might be related to telemetry, or some other non-content purpose.
//
// If also using the image-reachable-filter, this should occur after that filter
// so as to avoid pointless network requests. This filter is aware of the
// reachable filter, and includes a special check for whether the dimensions are
// already known as a result of that filter running.
//
// If concerned about telemetry, this should be run after any telemetry filter
// because this does network requests which expose presence.
export function image_dimensions_filter(doc, timeout = INDEFINITE) {
  assert(doc instanceof Document);
  assert(timeout instanceof Deadline);

  // This accesses an image's full url via its src property, so this relies on
  // the document having a valid baseURI property.
  assert(document_utils.has_valid_base_uri(doc));

  // Concurrently traverse and possibly update each image.
  const images = doc.querySelectorAll('img');
  const promises = [];
  for (const image of images) {
    promises.push(process_image(image, timeout));
  }
  // Return a promise that resolves when all images have been processed.
  return Promise.all(promises);
}

async function process_image(image, timeout) {
  // Attempt to avoid any processing
  if (image.hasAttribute('width') && image.hasAttribute('height')) {
    return;
  }

  // Before involving the network, use some heuristics to discern dimensions

  // Check for whether the reachability filter has run. If so, grab width and
  // height from its results and exit early so as to avoid wasted processing.
  if (image.hasAttribute('data-reachable-width') &&
      image.hasAttribute('data-reachable-height')) {
    image.setAttribute('width', image.getAttribute('data-reachable-width'));
    image.setAttribute('height', image.getAttribute('data-reachable-height'));
    return;
  }

  // TODO: give up on the idea of inline-only processing. This should probably
  // revert to using getComputedStyle

  // Check whether dimensions are available from css
  if (image.style && image.hasAttribute('style')) {
    let width = parseInt(image.style.width, 10);
    let height = parseInt(image.style.height, 10);
    if (!isNaN(width) && !isNaN(height) && width > 0 && height > 0) {
      image.setAttribute('width', width);
      image.setAttribute('height', height);
      return;
    }
  }

  // TODO: this should not rely on whether the responsive image filter has run.
  // Therefore this actually needs to be aware of the picture/source tactic for
  // getting an images source.

  // The remaining checks rely on the image having a source. While there are
  // other filters that may have already removed such images, leaving this as
  // wasted code, the design approach should be naive and ignore whether some
  // other filter has run, and tolerate the absence of some prior filter.
  if (!image.src) {
    return;
  }

  // Build the absolute url using the src property, which implicitly relies on
  // the document having a valid baseURI
  let url;
  try {
    url = new URL(image.src);
  } catch (error) {
    return;
  }

  // Check characters in url for non-data-uris
  const exts = ['jpg', 'gif', 'svg', 'bmp', 'png'];
  if (url.protocol !== 'data:' &&
      exts.includes(url_utils.url_get_extension(url))) {
    const pairs = [{w: 'w', h: 'h'}, {w: 'width', h: 'height'}];

    for (const pair of pairs) {
      let width = parseInt(url.searchParams.get(pairs.w), 10);
      let height = parseInt(url.searchParams.get(pairs.h), 10);
      if (!isNaN(width) && !isNaN(height) && width > 0 && height > 0) {
        image.setAttribute('width', width);
        image.setAttribute('height', height);
        return;
      }
    }
  }

  try {
    const fetched_image = await fetch_image_element(url, timeout);
    image.setAttribute('width', fetched_image.width);
    image.setAttribute('height', fetched_image.height);
  } catch (error) {
    if (error instanceof AssertionError) {
      throw error;
    } else {
      // Ignore
    }
  }
}
