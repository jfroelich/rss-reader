
import assert from "/src/assert.js";
import {removeImage} from "/src/dom.js";

export default function filter(doc) {
  assert(doc instanceof Document);

  if(!doc.body) {
    return;
  }

  const images = doc.body.querySelectorAll('img');
  for(const image of images) {
    if(isSourceless(image)) {
      removeImage(image);
    }
  }
}

// TODO: delegate to dom.js function, maybe inverse
function isSourceless(image) {
  return !image.hasAttribute('src') && !image.hasAttribute('srcset');
}
