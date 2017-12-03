import assert from "/src/assert/assert.js";
import {hasSource} from "/src/dom/image.js";
import {isValidURLString} from "/src/url/url-string.js";

// Transforms lazily-loaded images found in document content

// BUG: This type of message should not have shown up in the log:
// removing sourceless image <img data-src="url" alt="" content="url">
// This should have fixed that. I think. What about picture? I need to improve that debugging
// message so it checks for picture. Suspicion is this is all fallout from switching to
// hasSource. 

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
