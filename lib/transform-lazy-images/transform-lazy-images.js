// See license.md

'use strict';

// Scans the images in a document and modifies images that appear to be
// lazily loaded images
function transformLazyImages(document) {

  const isNotLazyImage = function(image) {
    return image.hasAttribute('src') || image.hasAttribute('srcset');
  };

  const isValidURLString = function(urlString) {
    return urlString && !urlString.trim().includes(' ');
  };

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

  // TODO: would it be better to use a querySelectorAll that looks for images
  // without certain attributes, instead of filtering in memory?
  const images = document.getAttributesByTagName('img');

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
