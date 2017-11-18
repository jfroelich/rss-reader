// Removes images that are missing source information from document content

import assert from "/src/assert.js";
import {imageHasSource, removeImage} from "/src/dom.js";

export default function filter(doc) {
  assert(doc instanceof Document);
  if(!doc.body) {
    return;
  }

  const images = doc.body.querySelectorAll('img');
  for(const image of images) {
    if(!imageHasSource(image)) {
      removeImage(image);
    }
  }
}
