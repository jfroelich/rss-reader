import assert from "/src/utils/assert.js";
import {removeImage} from "/src/utils/dom/image.js";

// Filters 'small' images from content. For example, social sharing icons.

export default function filterDocument(doc) {
  assert(doc instanceof Document);
  if(!doc.body) {
    return;
  }

  const images = doc.body.querySelectorAll('img');
  for(const image of images) {
    if(isSmallImage(image)) {
      removeImage(image);
    }
  }
}

function isSmallImage(image) {

  const widthString = image.getAttribute('width');
  if(!widthString) {
    return false;
  }

  const heightString = image.getAttribute('height');
  if(!heightString) {
    return false;
  }

  const widthInt = parseInt(widthString, 10);
  if(isNaN(widthInt)) {
    return false;
  }

  const heightInt = parseInt(heightString, 10);
  if(isNaN(heightInt)) {
    return false;
  }

  if(widthInt < 3) {
    return false;
  }

  if(heightInt < 3) {
    return false;
  }

  if(widthInt < 33 && heightInt < 33) {
    // console.debug('Small image detected', image.outerHTML);
    return true;
  }

  return false;
}
