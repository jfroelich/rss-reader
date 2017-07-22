// See license.md
'use strict';

{ // Begin file block scope

function transformLazyImages(document) {
  const lazyImageAttributes = [
    'load-src',
    'data-src',
    'data-original-desktop',
    'data-baseurl',
    'data-lazy',
    'data-img-src',
    'data-original',
    'data-adaptive-img',
    'data-imgsrc',
    'data-default-src'
  ];

  let numModified = 0;
  const images = document.getElementsByTagName('img');
  for(let image of images) {
    if(isNotLazyImage(image)) {
      continue;
    }

    for(let lazySrcAttrName of lazyImageAttributes) {
      if(image.hasAttribute(lazySrcAttrName)) {
        const urlString = image.getAttribute(lazySrcAttrName);
        if(isValidURLString(urlString)) {
          image.removeAttribute(lazySrcAttrName);
          image.setAttribute('src', urlString);
          numModified++;
          break;
        }
      }
    }
  }

  return numModified;
}

this.transformLazyImages = transformLazyImages;

function isNotLazyImage(image) {
  return image.hasAttribute('src') || image.hasAttribute('srcset');
}

function isValidURLString(urlString) {
  return urlString && !urlString.trim().includes(' ');
}

} // End file block scope
