// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

var lucu = lucu || {};

/**
 * For each image in the given html document, this inspects whether
 * dimensions are set for the image, and if not, fetches the dimensions
 * and sets the width and height attributes of the image. This expects
 * that the image src urls are already resolved.
 *
 * This assumes images are cached on request so it does not try to avoid
 * repeating requests to the same image when that image is used multiple
 * times in the document.
 *
 * TODO: avoid pinging tracker images?
 */
lucu.fetchImageDimensions = function(document, onComplete) {
  'use strict';
  var images = document.body.getElementsByTagName('img');
  var filter = Array.prototype.filter;
  var RE_DATA_URN = /^\s*data\s*:/i;
  var fetchables = filter.call(images, function (image) {
    var src = (image.getAttribute('src') || '').trim();
    return src && !image.getAttribute('width') && !image.width &&
      !RE_DATA_URN.test(src);
  });
  var counter = fetchables.length;
  var maybeCallback = function() {
    if(counter) return;
    onComplete();
  };
  var onerror = function() {
    counter--;
    maybeCallback();
  };

  // Ensure continuation in case of 0 fetchable images
  maybeCallback();

  fetchables.forEach(function (image) {
    var proxy = window.document.importNode(image, false);
    proxy.onerror = onerror;
    proxy.onload = function () {
      image.width = proxy.width;
      image.height = proxy.height;
      counter--;
      maybeCallback();
    };
    var temp = proxy.src;
    proxy.src = void temp;
    proxy.src = temp; // triggers fetch
  });
};
