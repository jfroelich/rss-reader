import assert from '/src/common/assert.js';
import {image_has_source, image_remove} from '/src/content-filter/content-filter-utils.js';

// TODO: move to basic filters

// Removes images that are missing source information from document content
export default function filter(doc) {
  assert(doc instanceof Document);
  if (!doc.body) {
    return;
  }

  // Use querySelectorAll over getElementsByTagName to simplify removal during
  // iteration.

  const images = doc.body.querySelectorAll('img');
  for (const image of images) {
    if (!image_has_source(image)) {
      // console.debug('Removing image', image.outerHTML);
      image_remove(image);
    }
  }
}
