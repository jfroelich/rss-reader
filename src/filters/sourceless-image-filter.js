'use strict';

// import base/assert.js
// import base/errors.js
// import dom.js

function sourcelessImageFilter(doc) {
  assert(doc instanceof Document);

  if(!doc.body) {
    return RDR_OK;
  }

  const images = doc.body.querySelectorAll('img');
  for(const image of images) {
    if(sourcelessImageFilterIsSourceless(image)) {
      domRemoveImage(image);
    }
  }

  return RDR_OK;
}

// TODO: delegate to dom.js function, maybe inverse
function sourcelessImageFilterIsSourceless(image) {
  return !image.hasAttribute('src') && !image.hasAttribute('srcset');
}
