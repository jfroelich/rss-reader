import {hasSource, removeImage} from "/src/dom/image.js";
import assert from "/src/assert/assert.js";

// Removes images that are missing source information from document content

export default function filter(doc) {
  assert(doc instanceof Document);
  if(!doc.body) {
    return;
  }

  const images = doc.body.querySelectorAll('img');
  for(const image of images) {
    if(!hasSource(image)) {
      removeImage(image);
    }
  }
}
