import assert from "/src/assert/assert.js";
import {hasSource, removeImage} from "/src/utils/dom/image.js";

// Removes images that are missing source information from document content
export default function filter(doc) {
  assert(doc instanceof Document);
  if(!doc.body) {
    return;
  }

  // Use querySelectorAll over getElementsByTagName to simplify removal during iteration.

  const images = doc.body.querySelectorAll('img');
  for(const image of images) {
    if(!hasSource(image)) {
      //console.debug('Removing image', image.outerHTML);
      removeImage(image);
    }
  }
}
