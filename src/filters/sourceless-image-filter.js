import assert from "/src/assert/assert.js";
import {hasSource, removeImage} from "/src/dom/image.js";

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
      // TEMP: logging unhandled images for improving lazy/responsive filters
      console.debug('removing sourceless image', image.outerHTML);

      removeImage(image);
    }
  }
}
