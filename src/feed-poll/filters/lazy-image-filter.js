import assert from "/src/common/assert.js";
import {imageHasSource} from "/src/common/dom-utils.js";

// Transforms lazily-loaded images found in document content

// TODO: try and determine if an image with a src attribute is using a
// placeholder image in the src attribute and a full image from another
// attribute

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
    if(imageHasSource(image)) {
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

// Only minor validation for speed. Tolerates bad input. This isn't intended to be the most
// accurate classification. Instead, it is intended to easily find bad urls and rule them out as
// invalid, even though some slip through, and not unintentionally rule out good urls.
// @param value {Any} should be a string but this tolerates bad input
// @returns {Boolean}
function isValidURLString(value) {
  // The upper bound on len is an estimate, kind of a safeguard, hopefully never causes a problem
  return typeof value === 'string' &&
    value.length > 1 && value.length <= 3000 &&
    !value.trim().includes(' ');
}
