// Transforms lazily-loaded images found in document content

import assert from "/src/assert.js";
import {imageHasSource} from "/src/dom.js";
import {isValidURLString} from "/src/url-string.js";

export default function filter(doc) {
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
    if(imageHasSource(image)) {
      continue;
    }

    for(const lazySourceName of lazyAttributes) {
      if(image.hasAttribute(lazySourceName)) {
        const imageSource = image.getAttribute(lazySourceName);
        if(isValidURLString(imageSource)) {
          image.removeAttribute(lazySourceName);
          image.setAttribute('src', imageSource);
          break;
        }
      }
    }
  }
}
