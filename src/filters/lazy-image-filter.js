import assert from "/src/utils/assert.js";
import {hasSource} from "/src/utils/dom/image.js";
import {isValidURLString} from "/src/utils/url-string-utils.js";

// Transforms lazily-loaded images found in document content

// TODO: try and determine if an image with a src attribute is using a placeholder image in the
// src attribute and a full image from another attribute

const DEBUG = false;

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

  const images = doc.body.getElementsByTagName('img');

  for(const image of images) {
    if(hasSource(image)) {
      continue;
    }

    const attributeNames = image.getAttributeNames();

    for(const lazyAttributeName of kLazyAttributeNames) {
      if(attributeNames.includes(lazyAttributeName)) {
        const lazyAttributeValue = image.getAttribute(lazyAttributeName);
        if(isValidURLString(lazyAttributeValue)) {
          transform(image, lazyAttributeName, lazyAttributeValue);
          break;
        }
      }
    }
  }
}

function transform(image, lazyAttributeName, lazyAttributeValue) {
  let before;
  if(DEBUG) {
    before = image.outerHTML;
  }

  // Remove the lazy attribute, it is no longer needed.
  image.removeAttribute(lazyAttributeName);

  // Create a src, or replace whatever is in the current src, with the value from the lazy
  // attribute.
  image.setAttribute('src', lazyAttributeValue);

  if(DEBUG) {
    const after = image.outerHTML;
    console.debug('transform', before, after);
  }
}
