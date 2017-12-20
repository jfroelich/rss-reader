import assert from "/src/assert/assert.js";

// Filters width and height of large images to avoid skewing in view
// An image is large if it is more than 1000px in width or height
// This allows retaining of width and height in other images, which avoids the issue of removing
// width and height from small images that have very large natural width or height. This is typical
// of icon or svg images that are very large when missing dimensions.
export default function filterDocument(doc) {
  assert(doc instanceof Document);
  if(!doc.body) {
    return;
  }

  const images = doc.body.querySelectorAll('img');
  for(const image of images) {
    if(isLargeImage(image)) {
      image.removeAttribute('width');
      image.removeAttribute('height');
    }
  }
}

function isLargeImage(image) {
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
  } else if(widthInt > 1000) {
    return true;
  }

  const heightInt = parseInt(heightString, 10);
  if(isNaN(heightInt)) {
    return false;
  } else if(heightInt > 1000) {
    return true;
  }

  return false;
}
