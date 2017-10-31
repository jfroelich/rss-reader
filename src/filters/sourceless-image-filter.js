'use strict';

// import base/errors.js

function sourcless_image_filter(doc) {
  console.assert(doc instanceof Document);

  if(!doc.body) {
    return RDR_OK;
  }

  const images = doc.body.querySelectorAll('img');
  for(const image of images) {
    if(sourcless_image_filter_is_sourceless(image)) {
      sourcless_image_filter_remove(image);
    }
  }

  return RDR_OK;
}

function sourcless_image_filter_is_sourceless(image) {
  return !image.hasAttribute('src') && !image.hasAttribute('srcset');
}

function sourcless_image_filter_remove(image) {
  image.remove();
}
