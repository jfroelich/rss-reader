import assert from "/src/assert/assert.js";
import {hasSource} from "/src/dom/image.js";
import {isValidURLString} from "/src/url/url-string.js";

// Transforms lazily-loaded images found in document content

// TODO: try and determine if an image with a src attribute is using a placeholder image in the
// src attribute and a full image from another attribute


const kLazyAttributeNames = [
  'load-src',
  'data-src',
  'data-src-full16x9',
  'data-src-large',
  'data-original-desktop',
  'data-baseurl',
  'data-flickity-lazyload',
  'data-lazy',
  'data-path',
  'data-image-src',
  'data-original',
  'data-adaptive-image',
  'data-imgsrc',
  'data-default-src',
  'data-hi-res-src'
];

export default function filter(doc) {
  assert(doc instanceof Document);
  if(!doc.body) {
    return;
  }

  // Aha, this was the culprit of the bug! This was searching for 'image' not 'img', which I
  // inadvertantly set when changing use of img to image in variable names using find and replace
  // in code editor.
  const images = doc.body.getElementsByTagName('img');

  for(const image of images) {
    if(hasSource(image)) {
      continue;
    }

    const attributeNames = image.getAttributeNames();

    for(const lazySourceName of kLazyAttributeNames) {
      if(attributeNames.includes(lazySourceName)) {
        const lazySourceAttributeValue = image.getAttribute(lazySourceName);
        if(isValidURLString(lazySourceAttributeValue)) {
          image.removeAttribute(lazySourceName);
          image.setAttribute('src', lazySourceAttributeValue);

          console.debug('lazy transform', image.outerHTML);

          break;
        } else {
          console.debug('found lazy attribute but its value was invalid', image.outerHTML);
        }
      }
    }
  }
}
