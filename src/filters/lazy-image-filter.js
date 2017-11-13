
import {assert} from "/src/assert.js";
import {domImageHasSource} from "/src/dom.js";
import {isValidURL} from "/src/url.js";

export function lazyImageFilter(doc) {
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
    if(domImageHasSource(image)) {
      continue;
    }

    for(const lazySourceName of lazyAttributes) {
      if(image.hasAttribute(lazySourceName)) {
        const imageSource = image.getAttribute(lazySourceName);
        if(isValidURL(imageSource)) {
          //const preHTML = image.outerHTML;
          image.removeAttribute(lazySourceName);
          image.setAttribute('src', imageSource);
          //const postHTML = image.outerHTML;
          //console.log('lazy:', preHTML, postHTML);
          break;
        }
      }
    }
  }
}
