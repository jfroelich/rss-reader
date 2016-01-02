// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

{ // BEGIN FILE SCOPE

// Modifies various image elements that appear as lazily-loaded in an effort
// to improve the number of images captured, given that scripting is disabled,
// so the app does not support responsive design.
// This should occur prior to removing sourceless images, and prior to trying
// to set image dimensions, because those functions have different outcomes
// based on whether the image has a source, which this function possibly
// changes.
function transformLazyImages(document) {
  const images = document.querySelectorAll('img');
  const numImages = images.length;
  for(let i = 0; i < numImages; i++) {
    transformImageElement(images[i]);
  }
}

// Export global
this.transformLazyImages = transformLazyImages;

// Test the various rules, and if one matches, modify the image
// Eventually, this could be designed to work off a collection of rules
// Or we could look for all url-like attributes?
// http://stackoverflow.com/questions/1500260

// TODO: I am very sloppily just adding rules here as I find them. There is
// probably overlap and stuff is a bit off, overly specific or overly general.
// i will eventually have to pick the appropriate granularity.

// TODO: maybe i should check that the new url being chosen looks like an
// image url.
// we could impose the requirements that it either ends in a known image
// format, or has a ? indicating some type of cgi-generated image. it would
// fail sometimes but work most of the time. the result would be that we
// make fewer mistakes to creating requests to invalid urls
function transformImageElement(image) {

  // Case 1: <img lazy-state="queue" load-src="url">
  if(image.hasAttribute('lazy-state') &&
    image.getAttribute('lazy-state') === 'queue') {
    image.setAttribute('src', image.getAttribute('load-src'));
    return;
  }

  // Case 2: <img load-src="url">
  if(!image.hasAttribute('src') && image.hasAttribute('load-src')) {
    image.setAttribute('src', image.getAttribute('load-src'));
    return;
  }

  // Case 3: <img src="blankurl" class="lazy-image" data-src="url">
  if(image.dataset && image.dataset.src &&
    image.classList.contains('lazy-image')) {
    image.setAttribute('src', image.dataset.src);
    return;
  }

  // Case 4: <img data-src="url">
  if(image.hasAttribute('data-src') && !image.hasAttribute('src')) {
    image.setAttribute('src', image.getAttribute('src'));
    return;
  }

  // Responsive design conflicts with the approach this takes, but oh well
  // Case 5: <img class="lazy" data-original-desktop="url"
  // data-original-tablet="url" data-original-mobile="url">
  if(image.classList.contains('lazy') && image.dataset.originalDesktop) {
    image.setAttribute('src', image.getAttribute('data-original-desktop'));
    return;
  }

  //<img data-baseurl="url">
  if(!image.hasAttribute('src') && image.hasAttribute('data-baseurl')) {
    image.setAttribute('src', image.getAttribute('data-baseurl'));
    return;
  }

  //<img data-lazy="" alt="">
  if(!image.hasAttribute('src') && image.hasAttribute('data-lazy')) {
    image.setAttribute('src', image.getAttribute('data-lazy'));
    return;
  }

  // <img data-img-src="" width="316" height="421">
  if(!image.hasAttribute('src') && image.hasAttribute('data-img-src')) {
    image.setAttribute('src', image.getAttribute('data-img-src'));
    return;
  }

  // Hmm, not quite sure about what to do with responsive design
  //<img itemprop="image" srcset="url, url 2x">

}

} // END FILE SCOPE
