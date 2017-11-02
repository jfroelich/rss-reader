'use strict';

// import net/url.js
// import dom.js

function lazyImageFilter(doc) {
  console.assert(doc instanceof Document);

  if(!doc.body) {
    return RDR_OK;
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
        if(urlIsValid(imageSource)) {
          const preHTML = image.outerHTML;
          image.removeAttribute(lazySourceName);
          image.setAttribute('src', imageSource);
          const postHTML = image.outerHTML;
          console.log('lazy:', preHTML, postHTML);
          break;
        }
      }
    }
  }

  return RDR_OK;
}
