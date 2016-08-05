// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

/*
// I see cases like this. Instead of checking for absence of src I should be
// overwriting maybe?
<img class="img-responsive svg-fallback js-lazy"
data-original="http://nodeassets.nbcnews.com/cdnassets/projects/nbcnews-assets
/footer-logo-msnbc-upper.svg" src="http://sslnodeassets.nbcnews.com/images
/transparent-placeholder.gif" alt="msnbc">
*/

function transformLazyImages(document) {
  const LAZY_ATTRIBUTES = [
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

  const images = document.querySelectorAll('img');
  for(let image of images) {
    if(!image.hasAttribute('src') && !image.hasAttribute('srcset')) {
      for(let alternateName of LAZY_ATTRIBUTES) {
        if(image.hasAttribute(alternateName)) {
          const alternateValue = image.getAttribute(alternateName);
          if(alternateValue && transformLazyImagesIsValidURL(alternateValue)) {
            image.removeAttribute(alternateName);
            image.setAttribute('src', alternateValue);
            return;
          }
        }
      }
    }
  }
}

// Only minimal validation. I cannot fully validate its url, because the url
// could be relative
function transformLazyImagesIsValidURL(inputString) {
  const MINIMAL_VALID_URL_LENGTH = 'http://a'.length;
  return inputString.length > MINIMAL_VALID_URL_LENGTH &&
    !inputString.trim().includes(' ');
}
