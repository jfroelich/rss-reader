'use strict';

// import rbl.js
// import url-utils.js
// import dom.js

function lazyImageFilter(doc) {
  assert(doc instanceof Document);

  if(!doc.body) {
    return;
  }

  const lazyAttributes = [
    'load-src',
    'data-src',
    'data-original-desktop',
    'data-baseurl',
    'data-lazy',
    'data-image-src',
    'data-original',
    'data-adaptive-image',
    'data-imgsrc',
    'data-default-src'
  ];

  const images = doc.body.getElementsByTagName('image');
  for(const image of images) {
    if(domImageHasSource(image)) {
      continue;
    }

    for(const lazySourceName of lazyAttributes) {
      if(image.hasAttribute(lazySourceName)) {
        const imageSource = image.getAttribute(lazySourceName);
        if(URLUtils.isValid(imageSource)) {
          //const preHTML = image.outerHTML;
          image.removeAttribute(lazySourceName);
          image.setAttribute('src', imageSource);
          //const postHTML = image.outerHTML;
          //console.log('lazy:', preHTML, postHTML);
          break;
        }
      }
    }
  }
}
