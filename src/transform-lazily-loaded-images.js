// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// Examines all image elements in the document. If an image does not have a
// source attribute, then this looks for commonly used attributes to signify
// a lazily loaded image. A lazily loaded image is one that is later loaded
// via script. If one is found, this sets the src attribute and removes the
// alternate attribute.
function transformLazilyLoadedImages(document) {

  const ALTERNATE_ATTRIBUTE_NAMES = [
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

  const MINIMAL_VALID_URL_LENGTH = 'http://a'.length;

  const images = document.querySelectorAll('img');
  // Not using for .. of due to profiling error NotOptimized TryCatchStatement
  //for(let image of images) {
  for(let i = 0, len = images.length; i < len; i++) {
    let image = images[i];
    if(!hasSource(image)) {
      //for(let alternateName of ALTERNATE_ATTRIBUTE_NAMES) {
      for(let j = 0, alen = ALTERNATE_ATTRIBUTE_NAMES.length; j < alen; j++) {
        let alternateName = ALTERNATE_ATTRIBUTE_NAMES[j];
        if(image.hasAttribute(alternateName)) {
          const alternateValue = image.getAttribute(alternateName);
          if(alternateValue && isMinimallyValidURL(alternateValue)) {
            image.removeAttribute(alternateName);
            image.setAttribute('src', alternateValue);
            break;
          }
        }
      }
    }
  }

  // This does only minimal validation of the content of the alternate
  // attribute value. I cannot fully validate its url, because the url could be
  // relative, because this may be called prior to resolving image source urls.
  // Therefore, the only validation I do is check whether the alternate value
  // contains an intermediate space. Neither relative nor absolute urls can
  // contain a space, so in that case I can be positive it isn't a valid
  // alternative.
  // TODO: maybe also test for other invalid characters?

  function isMinimallyValidURL(inputString) {
    return inputString.length > MINIMAL_VALID_URL_LENGTH &&
      !inputString.trim().includes(' ');
  }

  function hasSource(imageElement) {
    return imageElement.hasAttribute('src') ||
      imageElement.hasAttribute('srcset');
  }
}
