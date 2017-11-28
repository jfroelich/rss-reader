import {hasSource} from "/src/dom/image.js";
import assert from "/src/assert/assert.js";
import {isValidURLString} from "/src/url/url-string.js";

// Transforms lazily-loaded images found in document content


const kLazyAttributeNames = [
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

export default function filter(doc) {
  assert(doc instanceof Document);

  if(!doc.body) {
    return;
  }

  const images = doc.body.getElementsByTagName('image');
  for(const image of images) {
    if(hasSource(image)) {
      continue;
    }

    for(const lazySourceName of kLazyAttributeNames) {
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
