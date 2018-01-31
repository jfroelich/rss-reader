import assert from '/src/common/assert.js';
import {imageHasSource, removeImage} from '/src/feed-poll/filters/content-filter-utils.js';

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
    if (!imageHasSource(image)) {
      // console.debug('Removing image', image.outerHTML);
      removeImage(image);
    }
  }
}
