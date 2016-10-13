// See license.md

'use strict';

// TODO: Still see cases like this: <img data-original="url" src="url">
// Instead of checking for absence of src, maybe always overwrite
// TODO: browser may tolerate spaces in urls?

{

function transformLazyImages(doc) {
  const images = doc.querySelectorAll('img');
  for(let img of images) {
    transformImage(img);
  }
}

const attrs = [
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

function transformImage(img) {
  if(img.hasAttribute('src') || img.hasAttribute('srcset')) {
    return;
  }

  for(let altName of attrs) {
    if(img.hasAttribute(altName)) {
      const altValue = img.getAttribute(altName);
      if(altValue && isValidURL(altValue)) {
        img.removeAttribute(altName);
        img.setAttribute('src', altValue);
        return;
      }
    }
  }
}

// Only minimal validation against possibly relative urls
function isValidURL(str) {
  return !str.trim().includes(' ');
}

this.transformLazyImages = transformLazyImages;

}
