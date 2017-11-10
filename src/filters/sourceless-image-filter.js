'use strict';

// import dom.js
// import rbl.js

function sourcelessImageFilter(doc) {
  assert(doc instanceof Document);

  if(!doc.body) {
    return;
  }

  const images = doc.body.querySelectorAll('img');
  for(const image of images) {
    if(sourcelessImageFilterIsSourceless(image)) {
      domRemoveImage(image);
    }
  }
}

// TODO: delegate to dom.js function, maybe inverse
function sourcelessImageFilterIsSourceless(image) {
  return !image.hasAttribute('src') && !image.hasAttribute('srcset');
}
