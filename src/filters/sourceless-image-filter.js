'use strict';

// import assert.js

function sourcless_image_filter(doc) {
  ASSERT(doc);

  if(!doc.body) {
    return;
  }

  const images = doc.body.querySelectorAll('img');
  for(const image of images) {
    if(sourcless_image_filter_is_sourceless(image)) {
      sourcless_image_filter_remove(image);
    }
  }
}

function sourcless_image_filter_is_sourceless(image) {
  return !image.hasAttribute('src') && !image.hasAttribute('srcset');
}

function sourcless_image_filter_remove(image) {
  image.remove();
}
