// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

var lucu = lucu || {};

/**
 * Fetches and sets dimensions of image elements lacking dimensions.
 * Does not try to avoid repeated requests.
 *
 * TODO: support HTML5 picture elements
 * TODO: support HTML5 srcset
 */
lucu.fetchImageDimensions = function(hostDocument, document, onComplete) {
  'use strict';
  var filter = Array.prototype.filter;
  var images = document.body.getElementsByTagName('img');
  lucu.asyncForEach(filter.call(images, function isFetchable(image) {

    // TODO: it is possible that an image does not have a src but
    // has a srcset attribute, or both, or neither.

    var src = (image.getAttribute('src') || '').trim();
    return src && !image.getAttribute('width') && !image.width &&
      !/^\s*data\s*:/i.test(src);
  }), function fetch(image, callback) {
    var proxy = null;

    // NOTE: uncertain about the use of try catch here, but it looks like
    // importNode can throw. I believe it throws because this is the critical
    // transition from an inert document context to a live document context.
    // Not sure if the exceptions are catchable or the console errors are
    // automatic (similar to uncatchable XMLHttpRequest.send exceptions).
    // However, hopefully these are catchable, and if so, we want to ensure
    // continutation.

    try {
      var deep = false;
      proxy = hostDocument.importNode(image, deep);
    } catch(e) {

      // See http://time.com/3575719/ebola-kaci-hickox-maine/
      // <img src="http://timedotcom.files.wordpress.com/2014/11/kaci-hickox-
      // ebola.jpg?w=1100" itemprop="image" alt="Kaci Hickox Ebola Nurse"
      // srcset="http://timedotcom.files.wordpress.com/2014/11/kaci-hickox-
      // ebola.jpg?w=1100 800w, http://timedotcom.files.wordpress.com/2014/11/
      // kaci-hickox-ebola.jpg?w=1100 800w 2x" data-loaded="true">
      // Error: Failed parsing 'srcset' attribute value since it has multiple 'x'
      // descriptors or a mix of 'x' and 'w'/'h' descriptors.
      // Error: Dropped srcset candidate http://timedotcom.files.wordpress.com/
      // 2014/11/kaci-hickox-ebola.jpg?w=1100
      console.warn('importNode exception: %s, %o', image.outerHTML, e);
      return callback();
    }

    proxy.onerror = callback;
    proxy.onload = function() {
      image.width = proxy.width;
      image.height = proxy.height;
      callback();
    };
    var temp = proxy.src;
    proxy.src = void temp;
    proxy.src = temp;
  }, onComplete);
};
